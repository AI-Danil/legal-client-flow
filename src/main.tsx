import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  CirclePlus,
  ClipboardList,
  Clock3,
  RotateCw,
  Settings,
  UserRoundPlus,
} from "lucide-react";
import "./styles.css";

type ClientStatus = "new" | "in_progress" | "closed";

type Client = {
  id: string;
  name: string;
  phone: string;
  status: ClientStatus;
  createdAt: string;
};

const statusMeta: Record<
  ClientStatus,
  { label: string; shortLabel: string; icon: typeof Clock3 }
> = {
  new: { label: "Новый", shortLabel: "Новые", icon: Clock3 },
  in_progress: { label: "В работе", shortLabel: "В работе", icon: BriefcaseBusiness },
  closed: { label: "Закрыт", shortLabel: "Закрыты", icon: CheckCircle2 },
};

const orderedStatuses: ClientStatus[] = ["new", "in_progress", "closed"];

const seedClients: Client[] = [
  {
    id: "client-1",
    name: "Анна Петрова",
    phone: "+7 921 333-45-67",
    status: "new",
    createdAt: "2026-07-09T09:10:00.000Z",
  },
  {
    id: "client-2",
    name: "Илья Смирнов",
    phone: "+7 915 204-18-90",
    status: "in_progress",
    createdAt: "2026-07-09T10:24:00.000Z",
  },
  {
    id: "client-3",
    name: "Мария Лебедева",
    phone: "+7 903 700-11-22",
    status: "closed",
    createdAt: "2026-07-08T14:42:00.000Z",
  },
];

const clientsStorageKey = "legal-client-flow.clients";
const webhookStorageKey = "legal-client-flow.webhook-url";

function App() {
  const [clients, setClients] = useState<Client[]>(() => {
    const stored = localStorage.getItem(clientsStorageKey);
    if (!stored) return seedClients;

    try {
      return JSON.parse(stored) as Client[];
    } catch {
      return seedClients;
    }
  });
  const [webhookUrl, setWebhookUrl] = useState(
    () => localStorage.getItem(webhookStorageKey) ?? "",
  );
  const [form, setForm] = useState({
    name: "",
    phone: "",
    status: "new" as ClientStatus,
  });
  const [notificationLog, setNotificationLog] = useState(
    "Webhook не настроен. Клиенты сохраняются локально.",
  );

  useEffect(() => {
    localStorage.setItem(clientsStorageKey, JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem(webhookStorageKey, webhookUrl);
  }, [webhookUrl]);

  const counters = useMemo(() => {
    return orderedStatuses.reduce<Record<ClientStatus, number>>(
      (acc, status) => {
        acc[status] = clients.filter((client) => client.status === status).length;
        return acc;
      },
      { new: 0, in_progress: 0, closed: 0 },
    );
  }, [clients]);

  const addClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    if (!trimmedName || !trimmedPhone) return;

    const nextClient: Client = {
      id: crypto.randomUUID(),
      name: trimmedName,
      phone: trimmedPhone,
      status: form.status,
      createdAt: new Date().toISOString(),
    };

    setClients((current) => [nextClient, ...current]);
    setForm({ name: "", phone: "", status: "new" });
    await sendWebhook(nextClient);
  };

  const sendWebhook = async (client: Client) => {
    if (!webhookUrl.trim()) {
      setNotificationLog(`Клиент ${client.name} добавлен. Webhook не настроен.`);
      return;
    }

    try {
      await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "client_added",
          client: {
            ...client,
            status_label: statusMeta[client.status].label,
          },
          message: `Новый клиент: ${client.name}, ${client.phone}, статус: ${statusMeta[client.status].label}`,
        }),
      });
      setNotificationLog(`Webhook отправлен: ${client.name}`);
    } catch {
      setNotificationLog("Webhook не отправился. Проверьте URL или CORS на стороне сервиса.");
    }
  };

  const cycleStatus = (client: Client) => {
    const currentIndex = orderedStatuses.indexOf(client.status);
    const nextStatus = orderedStatuses[(currentIndex + 1) % orderedStatuses.length];

    setClients((current) =>
      current.map((item) =>
        item.id === client.id ? { ...item, status: nextStatus } : item,
      ),
    );
  };

  const resetDemo = () => {
    setClients(seedClients);
    setNotificationLog("Демо-данные восстановлены.");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">LegalTech prototype</p>
          <h1>Клиенты юриста</h1>
        </div>
        <button className="ghost-button" type="button" onClick={resetDemo}>
          <RotateCw size={18} aria-hidden="true" />
          Сбросить демо
        </button>
      </header>

      <section className="metrics-grid" aria-label="Статусы клиентов">
        {orderedStatuses.map((status) => {
          const Icon = statusMeta[status].icon;

          return (
            <article className={`metric metric-${status}`} key={status}>
              <div className="metric-icon">
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <span>{statusMeta[status].shortLabel}</span>
                <strong>{counters[status]}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="workspace">
        <form className="client-form" onSubmit={addClient}>
          <div className="section-title">
            <UserRoundPlus size={20} aria-hidden="true" />
            <h2>Добавить клиента</h2>
          </div>

          <label>
            Имя
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Иван Иванов"
              autoComplete="name"
            />
          </label>

          <label>
            Телефон
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="+7 900 000-00-00"
              autoComplete="tel"
            />
          </label>

          <label>
            Статус дела
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
            <CirclePlus size={18} aria-hidden="true" />
            Добавить
          </button>
        </form>

        <section className="automation-panel">
          <div className="section-title">
            <Settings size={20} aria-hidden="true" />
            <h2>Уведомление</h2>
          </div>

          <label>
            Webhook URL
            <input
              value={webhookUrl}
              onChange={(event) => setWebhookUrl(event.target.value)}
              placeholder="https://hook.eu1.make.com/..."
              inputMode="url"
            />
          </label>

          <div className="notification-status" role="status">
            <Bell size={18} aria-hidden="true" />
            <span>{notificationLog}</span>
          </div>
        </section>
      </section>

      <section className="table-section">
        <div className="section-title">
          <ClipboardList size={20} aria-hidden="true" />
          <h2>Список клиентов</h2>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th>Добавлен</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td data-label="Клиент">
                    <strong>{client.name}</strong>
                  </td>
                  <td data-label="Телефон">{client.phone}</td>
                  <td data-label="Статус">
                    <span className={`status-pill status-${client.status}`}>
                      {statusMeta[client.status].label}
                    </span>
                  </td>
                  <td data-label="Добавлен">
                    {new Intl.DateTimeFormat("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(client.createdAt))}
                  </td>
                  <td data-label="Действие">
                    <button
                      className="table-button"
                      type="button"
                      onClick={() => cycleStatus(client)}
                    >
                      <RotateCw size={16} aria-hidden="true" />
                      Следующий статус
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
