# README_STREAM_ONLINE_OFFLINE_ACTION_GATES

Safe patch for stream-status action gates.

## Rules added
- `Рейд` works only when the stream is online.
- `Кейс` works only when the stream is online.
- `Оффсбор` works only when the stream is offline.

## Backend hard guards
- `/api/farm/raid` now returns `error: stream_offline` when the stream is offline.
- `/api/farm/case/open` now returns `error: stream_offline` when the stream is offline.
- `/api/farm/off-collect` keeps the offline-only guard and now uses the shared helper.

## Frontend polish
- Main raid button is disabled while stream is offline.
- Case button is disabled while stream is offline.
- Offcollect button is disabled while stream is online.
- Messages explain which stream state is required.

## Files changed
- `routes/apiRoutes.js`
- `public/js/07a-ui-render-overrides.js`
- `public/js/10fa-extras-info-polish.js`
- `README-PATCH/README_STREAM_ONLINE_OFFLINE_ACTION_GATES.md`

## Safety notes
- No market changes.
- No buildings/realtime changes.
- No admin changes.
- No farm economy formula changes.
