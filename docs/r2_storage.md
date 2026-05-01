# R2 Storage

最終更新: 2026-04-30

## 目的

問題画像などのメディアは Cloudflare R2 に置き、Worker の `QUESTION_IMAGES` binding から `/api/question-images/<object-key>` で配信する。

## Buckets

| 環境 | bucket | binding | 配信 URL |
| :--- | :--- | :--- | :--- |
| staging | `quizly-question-images-staging` | `QUESTION_IMAGES` | `/api/question-images/<key>` |
| production | `quizly-question-images` | `QUESTION_IMAGES` | `/api/question-images/<key>` |
| preview/local preview | `quizly-question-images-preview` | `QUESTION_IMAGES` | `/api/question-images/<key>` |

Content JSON is also stored in R2, but it is not served by the app at runtime. It is downloaded by GitHub Actions and imported into D1.

| 環境 | content bucket | default object key |
| :--- | :--- | :--- |
| staging | `quizly-content-staging` | `content/japanese/grammar.json` |
| production | `quizly-content` | `content/japanese/grammar.json` |

## Setup

```bash
npx wrangler r2 bucket create quizly-question-images-staging
npx wrangler r2 bucket create quizly-content-staging
npx wrangler r2 bucket create quizly-question-images
npx wrangler r2 bucket create quizly-content
npx wrangler r2 bucket create quizly-question-images-preview
```

## Import

Question images are stored under `assets/question-images/` with paths that match `questions.image_url`.

```bash
npm run r2:upload:question-images:staging
```

The upload script writes to remote R2 by default. Use `node scripts/r2-upload-question-images.mjs --local` only for local Wrangler storage.

GitHub Actions also provides a manual `Cloudflare Content Update` workflow for staging R2/D1 content operations.

The current staging fixture uses:

- `dev/triangle-01.svg`
- `dev/clock-03-00.svg`

After uploading, update existing D1 rows if they still point at legacy `.png` fixture keys:

```bash
npm run d1:migrate:question-image-paths:staging
```

For question content, upload JSON to the content bucket, then download one object into the local fixture directory used by the seed script:

```bash
CONTENT_OBJECT_KEY=content/japanese/grammar.json npm run r2:download:content:staging
```

Then seed D1 reference data:

```bash
npm run d1:seed:reference:staging
```

`contents/` remains intentionally local/ignored. R2 content JSON is the shared source for GitHub Actions and rehearsal/cutover operations.

Current staging content objects:

- `content/japanese/grammar.json`
- `content/math/ueki-shuki.json`
- `content/science/space.json`
- `content/science/biology-01.json`
- `content/science/biology-02.json`
- `content/social/geo-01.json`
- `content/social/geo-02.json`

The GitHub Actions `Cloudflare Content Update` workflow imports one content object per run. Run it once for each changed object, or repeat it for every object when rebuilding a rehearsal database from scratch.

## Production Cutover Notes

- Create `quizly-question-images`.
- Upload the same object keys used by `questions.image_url`.
- Keep `NEXT_PUBLIC_QUESTION_IMAGE_BASE_URL=/api/question-images` unless moving to a custom image CDN/domain.
- Re-run the D1 reference seed only if object paths changed.
