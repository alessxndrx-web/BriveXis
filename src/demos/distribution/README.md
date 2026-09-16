# Distribution Operations

## Invariants and policies

- The immutable, signed movement ledger is the only physical inventory source. Warehouse stock is primary; product totals sum warehouses.
- Allocations reserve availability. Picking and packing never change physical stock. A shipment consumes allocation and posts physical stock exactly once.
- Receipts, shipments, payments, returns, and transfers carry stable operation IDs. Replaying one cannot post it twice.
- Canceling releases only unshipped commitments. Posted history remains intact.
- Quantities are whole units. Money is safe integer cents; tax uses integer basis points and rounds once per document.
- Invoice policy: one invoice after all non-cancelled order quantities ship. A cancelled, partially shipped order may invoice only its shipped quantities. Discount and freight are prorated to that shipped subtotal. No invoice contains unshipped units.
- Inventory returns do not issue financial refunds. Payment terms are informational. There is no general ledger, accounts payable, real payment processor, or credit-note workflow.
- Distribution owns its domain. Shared UI, repository mechanics, formatting, router, SEO and analytics remain the existing implementations.

## How this is verified

Unit tests in `distribution.test.ts`, `purchasing.test.ts`, `sales.test.ts`, `logistics.test.ts` and `distribution.reports.test.ts` cover the domain: the ledger, the purchase order and sales order lifecycles, partial receipt and partial shipment, duplicate-posting refusal, allocation and release, invoicing, payments, returns, transfers, global inventory conservation, the dashboard and report selectors, and recovery from unusable stored data.

`e2e/distribution/distribution.e2e.ts` drives the built application in a browser through the whole inbound and outbound lifecycle and asserts against the stored ledger rather than the screen, because a screen can be made to say anything. It also sweeps every module for heading-level skips, unlabelled controls and duplicate ids.

Actions that repeat once per row — Receive goods, Allocate stock, Mark picked, Mark packed, Post shipment — carry an `aria-label` naming the document they belong to. Without it a screen reader hears a list of identical buttons, and a test cannot address a specific row either.

Dialog forms are mounted only while open (`{flag && <Form open … />}`). The shared `useForm` seeds its state once on mount, so a form left mounted would reopen holding the previous attempt's values and error.
