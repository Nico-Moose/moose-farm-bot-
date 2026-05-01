# Extended admin fix

Fixed missing backend endpoints used by the extended admin panel:

- POST /api/admin/transfer-farm
- POST /api/admin/set-market-stock
- POST /api/admin/clear-debt
- POST /api/admin/reset-gamus
- POST /api/admin/reset-cases
- GET /api/admin/events
- GET /api/admin/checklist

The previous UI already had buttons for these actions, but adminRoutes.js did not contain the corresponding routes, so the frontend showed "Ошибка админ-действия" / "Not found".
