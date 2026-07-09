import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  CirclePlus,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";
import "./styles.css";

type ClientStatus = "new" | "in_progress" | "closed";
type StatusFilter = ClientStatus | "all";

type Client = {
  id: string;
  name: string;
  phone: string;
  status: ClientStatus;
  matterType: string;
  createdAt: string;
};

const statusMeta: Record<
  ClientStatus,
  { label: string; shortLabel: string; tone: string }
> = {
  new: { label: "Новый", shortLabel: "Новые", tone: "blue" },
  in_progress: { label: "В работе", shortLabel: "В работе", tone: "amber" },
  closed: { label: "Закрыт", shortLabel: "Закрыты", tone: "green" },
};

const orderedStatuses: ClientStatus[] = ["new", "in_progress", "closed"];

const seedClients: Client[] = [
  {
    id: "client-1",
    name: "Анна Петрова",
    phone: "+7 921 333-45-67",
    status: "new",
    matterType: "Семейный спор",
    createdAt: "2026-07-09T09:10:00.000Z",
  },
  {
    id: "client-2",
    name: "Илья Смирнов",
    phone: "+7 915 204-18-90",
    status: "in_progress",
    matterType: "Договор поставки",
    createdAt: "2026-07-09T10:24:00.000Z",
  },
  {
    id: "client-3",
    name: "Мария Лебедева",
    phone: "+7 903 700-11-22",
    status: "closed",
    matterType: "Наследство",
    createdAt: "2026-07-08T14:42:00.000Z",
  },
  {
    id: "client-4",
    name: "Олег Морозов",
    phone: "+7 999 481-03-18",
    status: "in_progress",
    matterType: "Претензия к застройщику",
    createdAt: "2026-07-08T16:05:00.000Z",
  },
];

const clientsStorageKey = "legal-client-flow.secure-session-clients";
const webhookStorageKey = "legal-client-flow.secure-session-webhook";
const tgTokenStorageKey = "legal-client-flow.secure-session-tg-token";
const tgChatStorageKey = "legal-client-flow.secure-session-tg-chat";
const legacyClientsStorageKey = "legal-client-flow.clients";
const legacyWebhookStorageKey = "legal-client-flow.webhook-url";

function isClientStatus(value: unknown): value is ClientStatus {
  return orderedStatuses.includes(value as ClientStatus);
}

function normalizeClient(raw: Partial<Client>, index: number): Client {
  return {
    id: raw.id ?? `client-${index + 1}`,
    name: raw.name?.trim() || "Клиент без имени",
    phone: raw.phone?.trim() || "+7 *** ***-**-**",
    status: isClientStatus(raw.status) ? raw.status : "new",
    matterType: raw.matterType?.trim() || "Юридическая консультация",
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function readSessionClients() {
  const stored = sessionStorage.getItem(clientsStorageKey);
  if (!stored) return seedClients;

  try {
    const parsed = JSON.parse(stored) as Partial<Client>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedClients;
    return parsed.map(normalizeClient);
  } catch {
    return seedClients;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function maskName(name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? "Клиент";
  const lastInitial = parts[1] ? `${parts[1][0]}.` : "";
  return `${firstName} ${lastInitial}`.trim();
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-2) || "**";
  return `+7 *** ***-**-${tail}`;
}

const phonePattern = /^[+()\d][\d\s()-]{9,}$/;

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return phonePattern.test(phone.trim()) && digits.length >= 10;
}

function nextActionFor(status: ClientStatus) {
  if (status === "new") return "Связаться в течение 15 минут и уточнить суть дела";
  if (status === "in_progress") return "Проверить ближайший дедлайн и запросить недостающие документы";
  return "Запросить отзыв и предложить дальнейшее сопровождение";
}

function clientNotificationText(client: Client, sendFullPii: boolean) {
  const name = sendFullPii ? client.name : maskName(client.name);
  const phone = sendFullPii ? client.phone : maskPhone(client.phone);
  return `Новый клиент: ${name}, ${phone}, дело: ${client.matterType}, статус: ${statusMeta[client.status].label}`;
}

function webhookSafePayload(client: Client, sendFullPii: boolean) {
  return {
    event: "client_added",
    client: {
      id: client.id,
      name: sendFullPii ? client.name : maskName(client.name),
      phone: sendFullPii ? client.phone : maskPhone(client.phone),
      status: client.status,
      status_label: statusMeta[client.status].label,
      matter_type: client.matterType,
      created_at: client.createdAt,
    },
    message: clientNotificationText(client, sendFullPii),
  };
}

const telegramTokenPattern = /^\d+:[A-Za-z0-9_-]{30,}$/;

function App() {
  const [clients, setClients] = useState<Client[]>(readSessionClients);
  const [selectedClientId, setSelectedClientId] = useState(seedClients[0].id);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [privacyEnabled, setPrivacyEnabled] = useState(true);
  const [copyGuardEnabled, setCopyGuardEnabled] = useState(true);
  const [sendFullPii, setSendFullPii] = useState(false);
  const [webhookConfirmed, setWebhookConfirmed] = useState(false);
  const [screenLocked, setScreenLocked] = useState(document.visibilityState === "hidden");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [webhookUrl, setWebhookUrl] = useState(
    () => sessionStorage.getItem(webhookStorageKey) ?? "",
  );
  const [tgToken, setTgToken] = useState(
    () => sessionStorage.getItem(tgTokenStorageKey) ?? "",
  );
  const [tgChatId, setTgChatId] = useState(
    () => sessionStorage.getItem(tgChatStorageKey) ?? "",
  );
  const [form, setForm] = useState({
    name: "",
    phone: "",
    matterType: "",
    status: "new" as ClientStatus,
  });
  const [notificationLog, setNotificationLog] = useState(
    "Данные хранятся только в sessionStorage. Внешняя отправка выключена.",
  );
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    sessionStorage.setItem(clientsStorageKey, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    sessionStorage.setItem(webhookStorageKey, webhookUrl);
  }, [webhookUrl]);

  useEffect(() => {
    sessionStorage.setItem(tgTokenStorageKey, tgToken);
  }, [tgToken]);

  useEffect(() => {
    sessionStorage.setItem(tgChatStorageKey, tgChatId);
  }, [tgChatId]);

  useEffect(() => {
    localStorage.removeItem(legacyClientsStorageKey);
    localStorage.removeItem(legacyWebhookStorageKey);

    const lockOnHiddenTab = () => {
      setScreenLocked(document.visibilityState === "hidden");
    };

    document.addEventListener("visibilitychange", lockOnHiddenTab);
    return () => document.removeEventListener("visibilitychange", lockOnHiddenTab);
  }, []);

  const counters = useMemo(() => {
    return orderedStatuses.reduce<Record<ClientStatus, number>>(
      (acc, status) => {
        acc[status] = clients.filter((client) => client.status === status).length;
        return acc;
      },
      { new: 0, in_progress: 0, closed: 0 },
    );
  }, [clients]);

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesStatus = statusFilter === "all" || client.status === statusFilter;
      const matchesQuery =
        !needle ||
        [client.name, client.phone, client.matterType, statusMeta[client.status].label]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesStatus && matchesQuery;
    });
  }, [clients, query, statusFilter]);

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ??
    filteredClients[0] ??
    clients[0] ??
    seedClients[0];

  const newMatterShare = clients.length ? Math.round((counters.new / clients.length) * 100) : 0;

  const addClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    if (!trimmedName || !trimmedPhone) return;

    if (!isValidPhone(trimmedPhone)) {
      setPhoneError("Введите телефон в формате +7 900 000-00-00 (минимум 10 цифр).");
      return;
    }
    setPhoneError("");

    const nextClient: Client = {
      id: crypto.randomUUID(),
      name: trimmedName,
      phone: trimmedPhone,
      matterType: form.matterType.trim() || "Юридическая консультация",
      status: form.status,
      createdAt: new Date().toISOString(),
    };

    setClients((current) => [nextClient, ...current]);
    setSelectedClientId(nextClient.id);
    setForm({ name: "", phone: "", matterType: "", status: "new" });
    await notifyAboutClient(nextClient);
  };

  const sendWebhook = async (client: Client): Promise<string | null> => {
    const targetUrl = webhookUrl.trim();
    if (!targetUrl) return null;

    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol !== "https:") {
        return "webhook заблокирован (только HTTPS)";
      }

      await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookSafePayload(client, sendFullPii)),
      });
      return "webhook отправлен";
    } catch {
      return "webhook не отправился (URL, CORS или сервис недоступен)";
    }
  };

  const sendTelegram = async (text: string): Promise<string | null> => {
    const token = tgToken.trim();
    const chatId = tgChatId.trim();
    if (!token || !chatId) return null;

    if (!telegramTokenPattern.test(token)) {
      return "Telegram: токен не похож на токен бота (формат 123456:ABC...)";
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      const data = (await response.json()) as { ok?: boolean; description?: string };
      if (data.ok) return "Telegram: уведомление доставлено";
      return `Telegram: ошибка (${data.description ?? "неизвестная"})`;
    } catch {
      return "Telegram: запрос не прошёл. Проверьте токен и сеть.";
    }
  };

  const notifyAboutClient = async (client: Client) => {
    const clientLabel = sendFullPii ? client.name : maskName(client.name);
    const hasChannels = Boolean(webhookUrl.trim() || (tgToken.trim() && tgChatId.trim()));

    if (!hasChannels) {
      setNotificationLog(`Клиент ${maskName(client.name)} добавлен. Внешние уведомления не настроены.`);
      return;
    }

    if (!webhookConfirmed) {
      setNotificationLog("Уведомления не отправлены: сначала включите явное согласие на внешнюю отправку.");
      return;
    }

    const text = clientNotificationText(client, sendFullPii);
    const results = (await Promise.all([sendWebhook(client), sendTelegram(text)])).filter(
      (result): result is string => result !== null,
    );
    setNotificationLog(`Клиент ${clientLabel} добавлен. ${results.join(". ")}.`);
  };

  const detectChatId = async () => {
    const token = tgToken.trim();
    if (!token) {
      setNotificationLog("Telegram: сначала введите токен бота.");
      return;
    }
    if (!telegramTokenPattern.test(token)) {
      setNotificationLog("Telegram: токен не похож на токен бота (формат 123456:ABC...).");
      return;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
      const data = (await response.json()) as {
        ok?: boolean;
        description?: string;
        result?: { message?: { chat?: { id: number } } }[];
      };
      if (!data.ok) {
        setNotificationLog(`Telegram: ошибка (${data.description ?? "проверьте токен"}).`);
        return;
      }
      const chat = [...(data.result ?? [])].reverse().find((update) => update.message?.chat?.id)
        ?.message?.chat;
      if (chat) {
        setTgChatId(String(chat.id));
        setNotificationLog(`Telegram: chat ID определён (${chat.id}).`);
      } else {
        setNotificationLog("Telegram: напишите боту любое сообщение и нажмите «Определить» ещё раз.");
      }
    } catch {
      setNotificationLog("Telegram: запрос не прошёл. Проверьте токен и сеть.");
    }
  };

  const sendTelegramTest = async () => {
    if (!tgToken.trim() || !tgChatId.trim()) {
      setNotificationLog("Telegram: введите токен бота и chat ID.");
      return;
    }
    if (!webhookConfirmed) {
      setNotificationLog("Telegram: сначала включите явное согласие на внешнюю отправку.");
      return;
    }
    const result = await sendTelegram(
      "Тест: Legal Client Flow подключён. Уведомления о новых клиентах будут приходить сюда.",
    );
    setNotificationLog(result ?? "Telegram: введите токен бота и chat ID.");
  };

  const updateStatus = (clientId: string, status: ClientStatus) => {
    setClients((current) =>
      current.map((client) => (client.id === clientId ? { ...client, status } : client)),
    );
  };

  const revealClient = (clientId: string) => {
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const resetDemo = () => {
    setClients(seedClients);
    setSelectedClientId(seedClients[0].id);
    setRevealedIds(new Set());
    setNotificationLog("Демо-данные восстановлены. Локальные следы очищены.");
  };

  const handleProtectedCopy = (event: React.ClipboardEvent<HTMLElement>) => {
    if (!privacyEnabled || !copyGuardEnabled) return;
    if (!(event.target instanceof HTMLElement) || !event.target.closest(".protected-text")) return;

    event.preventDefault();
    event.clipboardData.setData("text/plain", "Копирование PII отключено в privacy mode.");
    setNotificationLog("Copy guard остановил копирование: включен privacy mode.");
  };

  const renderName = (client: Client) =>
    privacyEnabled && !revealedIds.has(client.id) ? maskName(client.name) : client.name;

  const renderPhone = (client: Client) =>
    privacyEnabled && !revealedIds.has(client.id) ? maskPhone(client.phone) : client.phone;

  return (
    <main
      className={`app-shell ${screenLocked ? "screen-locked" : ""}`}
      onCopy={handleProtectedCopy}
    >
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">DP</span>
          <div>
            <p className="eyebrow">Legal Client Flow</p>
            <h1>Рабочий стол юриста</h1>
          </div>
        </div>

        <div className="top-actions">
          <button
            className={`toggle-button ${privacyEnabled ? "active" : ""}`}
            type="button"
            onClick={() => setPrivacyEnabled((current) => !current)}
          >
            {privacyEnabled ? <EyeOff size={17} /> : <Eye size={17} />}
            Privacy
          </button>
          <button className="ghost-button" type="button" onClick={resetDemo}>
            <RotateCw size={17} />
            Сброс
          </button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <p className="panel-kicker">Мини-CRM без лишней разработки</p>
          <h2>Клиенты, статусы и следующий шаг в одном экране</h2>
          <p>
            Прототип помогает юристу быстро принять заявку, не потерять клиента и
            сразу понять, что делать дальше по делу.
          </p>
        </div>
        <div className="trust-strip" aria-label="Защита данных">
          <span>
            <ShieldCheck size={16} />
            No trackers
          </span>
          <span>
            <LockKeyhole size={16} />
            Session vault
          </span>
          <span>
            <EyeOff size={16} />
            PII masked
          </span>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Статусы клиентов">
        {orderedStatuses.map((status) => (
          <article className={`metric metric-${status}`} key={status}>
            <span className={`status-dot dot-${statusMeta[status].tone}`} />
            <div>
              <span>{statusMeta[status].shortLabel}</span>
              <strong>{counters[status]}</strong>
            </div>
          </article>
        ))}
        <article className="metric metric-risk">
          <span className="status-dot dot-graphite" />
          <div>
            <span>Новых в очереди</span>
            <strong>{newMatterShare}%</strong>
          </div>
        </article>
      </section>

      <section className="work-grid">
        <form className="client-form panel-card" onSubmit={addClient}>
          <div className="section-title">
            <UserRoundPlus size={19} />
            <div>
              <h2>Новая заявка</h2>
              <p>Минимум полей, чтобы юрист сразу начал работу.</p>
            </div>
          </div>

          <label>
            Имя
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Иван Иванов"
              autoComplete="off"
            />
          </label>

          <label>
            Телефон
            <input
              value={form.phone}
              onChange={(event) => {
                setForm({ ...form, phone: event.target.value });
                if (phoneError) setPhoneError("");
              }}
              placeholder="+7 900 000-00-00"
              autoComplete="off"
              inputMode="tel"
              aria-invalid={Boolean(phoneError)}
            />
          </label>
          {phoneError && <p className="field-error">{phoneError}</p>}

          <label>
            Тип дела
            <input
              value={form.matterType}
              onChange={(event) => setForm({ ...form, matterType: event.target.value })}
              placeholder="Договор, наследство, спор"
              autoComplete="off"
            />
          </label>

          <label>
            Статус
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as ClientStatus })
              }
            >
              {orderedStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusMeta[status].label}
                </option>
              ))}
            </select>
          </label>

          <button className="primary-button" type="submit">
            <CirclePlus size={18} />
            Добавить клиента
          </button>
        </form>

        <section className="security-panel panel-card">
          <div className="section-title">
            <ShieldCheck size={19} />
            <div>
              <h2>Контур безопасности</h2>
              <p>Для демо: минимум внешних поверхностей и явное согласие на отправку.</p>
            </div>
          </div>

          <p className="security-disclaimer">
            Это UX-слой приватности на клиенте (маскирование, copy guard), а не серверная
            защита данных: любой, у кого есть доступ к этой вкладке, может выключить
            Privacy или прочитать данные через DevTools.
          </p>

          <div className="security-grid">
            <label className="check-row">
              <input
                type="checkbox"
                checked={privacyEnabled}
                onChange={(event) => setPrivacyEnabled(event.target.checked)}
              />
              <span>Маскировать PII на экране</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={copyGuardEnabled}
                onChange={(event) => setCopyGuardEnabled(event.target.checked)}
              />
              <span>Блокировать копирование в privacy mode</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={webhookConfirmed}
                onChange={(event) => setWebhookConfirmed(event.target.checked)}
              />
              <span>Разрешить внешние уведомления (webhook и Telegram)</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={sendFullPii}
                onChange={(event) => setSendFullPii(event.target.checked)}
              />
              <span>Отправлять полное имя и телефон в webhook</span>
            </label>
          </div>

          <label>
            Webhook URL
            <input
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://hook.eu1.make.com/..."
              inputMode="url"
              autoComplete="off"
            />
          </label>

          <label>
            Telegram bot token
            <input
              value={tgToken}
              onChange={(event) => setTgToken(event.target.value)}
              placeholder="123456789:AAE0abc..."
              autoComplete="off"
              type="password"
            />
          </label>

          <label>
            Telegram chat ID
            <input
              value={tgChatId}
              onChange={(event) => setTgChatId(event.target.value)}
              placeholder="Напишите боту /start и нажмите «Определить»"
              autoComplete="off"
            />
          </label>

          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={detectChatId}>
              <Search size={16} />
              Определить chat ID
            </button>
            <button className="ghost-button" type="button" onClick={sendTelegramTest}>
              <Send size={16} />
              Тест в Telegram
            </button>
          </div>

          <p className="security-hint">
            Токен хранится только в sessionStorage этой вкладки и уходит только в
            api.telegram.org. Используйте тестового бота, а не рабочего.
          </p>

          <div className="notification-status" role="status">
            <Bell size={17} />
            <span>{notificationLog}</span>
          </div>
        </section>
      </section>

      <section className="crm-grid">
        <section className="table-section panel-card">
          <div className="table-toolbar">
            <div className="section-title">
              <ClipboardList size={19} />
              <div>
                <h2>Клиенты</h2>
                <p>Фильтр, поиск и изменение статуса без перехода на другую страницу.</p>
              </div>
            </div>

            <div className="table-controls">
              <label className="search-box">
                <Search size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Поиск по клиенту, телефону или делу"
                  autoComplete="off"
                />
              </label>
              <div className="segmented-control" aria-label="Фильтр статуса">
                {(["all", ...orderedStatuses] as StatusFilter[]).map((status) => (
                  <button
                    className={statusFilter === status ? "selected" : ""}
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === "all" ? "Все" : statusMeta[status].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Тип дела</th>
                  <th>Статус</th>
                  <th>Следующий шаг</th>
                  <th>PII</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const isSelected = selectedClient.id === client.id;
                  const isRevealed = revealedIds.has(client.id);

                  return (
                    <tr
                      className={isSelected ? "selected-row" : ""}
                      key={client.id}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <td data-label="Клиент">
                        <button className="client-link" type="button">
                          <strong className="protected-text">{renderName(client)}</strong>
                          <span>{formatDate(client.createdAt)}</span>
                        </button>
                      </td>
                      <td data-label="Телефон">
                        <span className="protected-text">{renderPhone(client)}</span>
                      </td>
                      <td data-label="Тип дела">{client.matterType}</td>
                      <td data-label="Статус">
                        <select
                          className={`status-select status-${client.status}`}
                          value={client.status}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateStatus(client.id, event.target.value as ClientStatus)
                          }
                        >
                          {orderedStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusMeta[status].label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Следующий шаг">{nextActionFor(client.status)}</td>
                      <td data-label="PII">
                        <button
                          className="icon-button"
                          type="button"
                          title={isRevealed ? "Скрыть PII" : "Показать PII"}
                          onClick={(event) => {
                            event.stopPropagation();
                            revealClient(client.id);
                          }}
                        >
                          {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredClients.length === 0 && (
            <div className="empty-state">
              <FileText size={24} />
              <p>Клиентов по выбранным условиям нет.</p>
            </div>
          )}
        </section>

        <aside className="detail-panel panel-card">
          <div className="detail-header">
            <span className={`status-dot dot-${statusMeta[selectedClient.status].tone}`} />
            <div>
              <p>{statusMeta[selectedClient.status].label}</p>
              <h2 className="protected-text">{renderName(selectedClient)}</h2>
            </div>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Телефон</dt>
              <dd className="protected-text">{renderPhone(selectedClient)}</dd>
            </div>
            <div>
              <dt>Тип дела</dt>
              <dd>{selectedClient.matterType}</dd>
            </div>
            <div>
              <dt>Добавлен</dt>
              <dd>{formatDate(selectedClient.createdAt)}</dd>
            </div>
          </dl>

          <div className="next-action">
            <p>Следующий шаг</p>
            <strong>{nextActionFor(selectedClient.status)}</strong>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={() => revealClient(selectedClient.id)}
          >
            {revealedIds.has(selectedClient.id) ? <EyeOff size={17} /> : <Eye size={17} />}
            {revealedIds.has(selectedClient.id) ? "Скрыть PII" : "Раскрыть PII"}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setNotificationLog(
                `Шаблон сообщения подготовлен для ${privacyEnabled ? maskName(selectedClient.name) : selectedClient.name}.`,
              );
            }}
          >
            <Send size={17} />
            Подготовить сообщение
          </button>

          <div className="watermark-card">
            Demo watermark: Legal Client Flow / {new Date().toLocaleDateString("ru-RU")}
          </div>
        </aside>
      </section>

      <div className="screen-shield" aria-hidden={!screenLocked}>
        <LockKeyhole size={28} />
        <span>Данные скрыты: вкладка неактивна</span>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
