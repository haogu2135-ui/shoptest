# Shop Gateway

Spring Cloud Gateway entrypoint for the shop frontend.

The gateway reads service instances from Nacos and routes the frontend's unified
API paths:

- `/gateway/catalog/**` -> `shop-backend`
- `/gateway/order/**` -> `shop-backend`
- `/gateway/payment/**` -> `shop-backend`
- `/gateway/admin/**` -> `shop-backend`
- `/gateway/notification/**` -> `shop-backend`
- `/gateway/logistics/**` -> `shop-backend`
- `/gateway/app/**` -> `shop-backend`
- `/ws/support` -> `shop-backend` WebSocket

Frontend requests stay written as normal business paths. The React API layer
rewrites them to gateway paths when `REACT_APP_API_GATEWAY_ENABLED=true`, for
example `/products` becomes `/gateway/catalog/products` and `/admin/registry`
becomes `/gateway/admin/admin/registry`.

When modules are split into separate services later, change the route `uri` from
`lb://shop-backend` to the new Nacos service name, for example `lb://shop-catalog`.
