# Legal Client Flow

Рабочий прототип мини-CRM для юриста:

- таблица клиентов;
- добавление клиента с телефоном и статусом;
- смена статуса в один клик;
- счетчики по статусам;
- поиск и фильтр по статусам;
- панель выбранного клиента со следующим шагом;
- privacy mode: маскирование имени/телефона, раскрытие PII по кнопке;
- copy guard в privacy mode;
- хранение данных в `sessionStorage`, без долговременного `localStorage`;
- бонус: webhook-уведомление при добавлении клиента для Make, n8n, Zapier или собственного backend endpoint;
- security headers для Vercel/Netlify: CSP, Referrer-Policy, Permissions-Policy, X-Frame-Options.

## Запуск

```bash
npm install
npm run dev
```

## Деплой

Подходит для Vercel или Netlify:

- build command: `npm run build`
- publish directory: `dist`

В проекте есть `vercel.json` и `netlify.toml` с security headers. CSP разрешает исходящие запросы только на self и типовые webhook-домены Make/Zapier/n8n. Если используется другой webhook-домен, его нужно добавить в `connect-src`.

## Лог для отклика

Стек: React + Vite + TypeScript. Выбран, потому что за 2-3 часа позволяет быстро собрать живой продуктовый прототип без backend-зависимости, а данные можно хранить в session-only режиме и легко заменить на Supabase/Firebase позже.

Я сам определил сценарий, UX, структуру данных, privacy-поведение, логику статусов и проверил сборку. AI использовал как pair-programmer для ускорения реализации интерфейса, TypeScript-компонентов, CSS и текста продуктового лога.
