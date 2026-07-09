# Deployment

## GitHub

Рекомендуемый публичный репозиторий:

```text
https://github.com/AI-Danil/legal-client-flow
```

Локальный remote уже можно поставить так:

```bash
git remote add origin git@github.com:AI-Danil/legal-client-flow.git
git push -u origin main
```

Если репозиторий ещё не создан, сначала создайте пустой public repository `legal-client-flow` в аккаунте `AI-Danil`, без README, `.gitignore` и license.

## Netlify

### Через GitHub import

1. Netlify -> Add new site -> Import an existing project.
2. Выбрать GitHub repo `AI-Danil/legal-client-flow`.
3. Build command: `npm run build`.
4. Publish directory: `dist`.

### Через Netlify CLI

```bash
npm run build
npx netlify-cli login
npx netlify-cli deploy --prod --dir=dist
```

### Через Netlify Drop

1. Выполнить `npm run build`.
2. Открыть `https://app.netlify.com/drop`.
3. Выбрать папку `dist`.

## Security headers

В проекте есть готовые файлы:

- `vercel.json`
- `netlify.toml`

CSP разрешает исходящие запросы только на self и типовые webhook-домены Make/Zapier/n8n. Для другого webhook-домена нужно добавить его в `connect-src`.
