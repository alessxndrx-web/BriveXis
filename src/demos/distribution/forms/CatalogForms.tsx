import { useMemo, useState } from 'react';
import { useCommand, useWorkspace } from '../DistributionProvider';
import type { Address, Partner, Product } from '../distribution.types';
import { centsToInput, createId, dollarsToCents } from '../distribution.utils';
import { stock } from '../distribution.selectors';
import { track } from '../../../lib/analytics';
import { Button, Checkbox, FormField, Select, TextArea, TextInput } from '../../shared/ui/AppUI';
import { Dialog } from '../../shared/ui/Dialog';
import {
  AddressFields,
  MoneyInput,
  NumberInput,
  emptyAddressIn,
  useForm,
  validateAddress,
} from '../../shared/ui/formControls';

/**
 * Products, suppliers, customers and stock adjustments.
 *
 * Every one of these writes through `useCommand`, so a rule the domain refuses
 * comes back as a message in the dialog rather than an exception — and the
 * dialog stays open with what the visitor typed still in it.
 */

// ---------------------------------------------------------------- products

interface ProductFormValues {
  sku: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  unit: string;
  cost: string;
  price: string;
  reorderPoint: string;
  supplierId: string;
  active: boolean;
}

const UNITS = ['each', 'case', 'box', 'roll', 'bundle', 'pallet'];

export function ProductForm({
  open,
  onClose,
  product,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product?: Product;
  onSaved?: (id: string) => void;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(state.products.map((entry) => entry.category))).sort(),
    [state.products],
  );

  const form = useForm<ProductFormValues>({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? categories[0] ?? 'General',
    brand: product?.brand ?? '',
    unit: product?.unit ?? 'each',
    cost: product ? centsToInput(product.cost) : '',
    price: product ? centsToInput(product.price) : '',
    reorderPoint: String(product?.reorderPoint ?? 10),
    supplierId: product?.supplierId ?? '',
    active: product?.active ?? true,
  });

  const submit = () => {
    const id = product?.id ?? createId('product');
    const failure = run(
      {
        type: 'product/save',
        product: {
          id,
          sku: form.values.sku.trim().toUpperCase(),
          name: form.values.name.trim(),
          description: form.values.description.trim(),
          category: form.values.category.trim(),
          brand: form.values.brand.trim(),
          unit: form.values.unit,
          cost: dollarsToCents(form.values.cost || '0'),
          price: dollarsToCents(form.values.price || '0'),
          reorderPoint: Number(form.values.reorderPoint) || 0,
          supplierId: form.values.supplierId,
          active: form.values.active,
        },
      },
      product ? `${form.values.name.trim()} updated.` : 'Product created.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    onClose();
    onSaved?.(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product ? `Edit ${product.sku}` : 'New product'}
      description="Stock is never stored on a product — it is derived from warehouse movements."
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="SKU" htmlFor="product-sku">
            <TextInput
              id="product-sku"
              className="font-mono uppercase"
              value={form.values.sku}
              onChange={(event) => form.set('sku', event.target.value)}
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField label="Product name" htmlFor="product-name">
              <TextInput
                id="product-name"
                value={form.values.name}
                onChange={(event) => form.set('name', event.target.value)}
              />
            </FormField>
          </div>
        </div>

        <FormField label="Description" htmlFor="product-description" optional>
          <TextArea
            id="product-description"
            rows={2}
            value={form.values.description}
            onChange={(event) => form.set('description', event.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Category" htmlFor="product-category">
            <TextInput
              id="product-category"
              list="product-category-options"
              value={form.values.category}
              onChange={(event) => form.set('category', event.target.value)}
            />
            <datalist id="product-category-options">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </FormField>

          <FormField label="Brand" htmlFor="product-brand" optional>
            <TextInput
              id="product-brand"
              value={form.values.brand}
              onChange={(event) => form.set('brand', event.target.value)}
            />
          </FormField>

          <FormField label="Unit of measure" htmlFor="product-unit">
            <Select
              id="product-unit"
              value={form.values.unit}
              onChange={(event) => form.set('unit', event.target.value)}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <FormField label="Cost" htmlFor="product-cost">
            <MoneyInput
              id="product-cost"
              value={form.values.cost}
              onChange={(value) => form.set('cost', value)}
            />
          </FormField>

          <FormField label="Selling price" htmlFor="product-price">
            <MoneyInput
              id="product-price"
              value={form.values.price}
              onChange={(value) => form.set('price', value)}
            />
          </FormField>

          <FormField label="Reorder point" htmlFor="product-reorder">
            <NumberInput
              id="product-reorder"
              value={form.values.reorderPoint}
              onChange={(value) => form.set('reorderPoint', value)}
            />
          </FormField>

          <FormField label="Preferred supplier" htmlFor="product-supplier" optional>
            <Select
              id="product-supplier"
              value={form.values.supplierId}
              onChange={(event) => form.set('supplierId', event.target.value)}
            >
              <option value="">None</option>
              {state.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <Checkbox
          id="product-active"
          label="Active — can be ordered and sold"
          checked={form.values.active}
          onChange={(event) => form.set('active', event.target.checked)}
        />

        {error && (
          <p role="alert" className="text-[0.8125rem] text-app-danger">
            {error}
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- partners

interface PartnerFormValues {
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: Address;
  terms: string;
  leadDays: string;
  active: boolean;
}

const TERMS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on receipt'];

export function PartnerForm({
  open,
  onClose,
  kind,
  partner,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  kind: 'supplier' | 'customer';
  partner?: Partner;
  onSaved?: (id: string) => void;
}) {
  const run = useCommand();
  const [error, setError] = useState('');
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  const form = useForm<PartnerFormValues>({
    name: partner?.name ?? '',
    contact: partner?.contact ?? '',
    email: partner?.email ?? '',
    phone: partner?.phone ?? '',
    address: partner?.address ?? emptyAddressIn('TX'),
    terms: partner?.terms.replace(' (informational)', '') ?? 'Net 30',
    leadDays: String(partner?.leadDays ?? (kind === 'supplier' ? 5 : 0)),
    active: partner?.active ?? true,
  });

  const submit = () => {
    const problems = validateAddress(form.values.address, 'partner-address');
    setAddressErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const id = partner?.id ?? createId(kind);
    const failure = run(
      {
        type: kind === 'supplier' ? 'supplier/save' : 'customer/save',
        partner: {
          id,
          code: partner?.code ?? '',
          name: form.values.name.trim(),
          contact: form.values.contact.trim(),
          email: form.values.email.trim(),
          phone: form.values.phone.trim(),
          address: form.values.address,
          shippingAddress: kind === 'customer' ? form.values.address : undefined,
          terms: `${form.values.terms} (informational)`,
          leadDays: Number(form.values.leadDays) || 0,
          active: form.values.active,
        },
      },
      partner ? `${form.values.name.trim()} updated.` : `${kind === 'supplier' ? 'Supplier' : 'Customer'} created.`,
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    onClose();
    onSaved?.(id);
  };

  const label = kind === 'supplier' ? 'supplier' : 'customer';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={partner ? `Edit ${partner.name}` : `New ${label}`}
      description={
        kind === 'supplier'
          ? 'Purchase orders and inbound goods attach to a supplier record.'
          : 'Sales orders, shipments and invoices attach to a customer record.'
      }
      size="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {partner ? 'Save changes' : `Create ${label}`}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Company name" htmlFor="partner-name">
            <TextInput
              id="partner-name"
              value={form.values.name}
              onChange={(event) => form.set('name', event.target.value)}
            />
          </FormField>

          <FormField label="Primary contact" htmlFor="partner-contact" optional>
            <TextInput
              id="partner-contact"
              value={form.values.contact}
              onChange={(event) => form.set('contact', event.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Phone" htmlFor="partner-phone" optional>
            <TextInput
              id="partner-phone"
              type="tel"
              placeholder="(214) 555-0100"
              value={form.values.phone}
              onChange={(event) => form.set('phone', event.target.value)}
            />
          </FormField>

          <FormField label="Email" htmlFor="partner-email" optional>
            <TextInput
              id="partner-email"
              type="email"
              value={form.values.email}
              onChange={(event) => form.set('email', event.target.value)}
            />
          </FormField>
        </div>

        <div className="pt-3 border-t border-app-border">
          <AddressFields
            prefix="partner-address"
            legend="Address"
            value={form.values.address}
            errors={addressErrors}
            onChange={(address) => {
              form.set('address', address);
              setAddressErrors({});
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Payment terms" htmlFor="partner-terms">
            <Select
              id="partner-terms"
              value={form.values.terms}
              onChange={(event) => form.set('terms', event.target.value)}
            >
              {TERMS.map((term) => (
                <option key={term} value={term}>
                  {term}
                </option>
              ))}
            </Select>
          </FormField>

          {kind === 'supplier' && (
            <FormField label="Lead time (days)" htmlFor="partner-lead">
              <NumberInput
                id="partner-lead"
                value={form.values.leadDays}
                onChange={(value) => form.set('leadDays', value)}
              />
            </FormField>
          )}
        </div>

        <p className="text-[0.75rem] text-muted">
          Payment terms are informational in this demo. There is no accounts payable or receivable
          ageing engine behind them.
        </p>

        <Checkbox
          id="partner-active"
          label="Active"
          checked={form.values.active}
          onChange={(event) => form.set('active', event.target.checked)}
        />

        {error && (
          <p role="alert" className="text-[0.8125rem] text-app-danger">
            {error}
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Save
        </button>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------- adjustments

/**
 * Stock adjustment.
 *
 * There is no way to type a new on-hand figure anywhere in this application.
 * Correcting stock means posting a movement with a reason, which is what keeps
 * the ledger a complete account of why the number is what it is.
 */
export function AdjustmentForm({
  open,
  onClose,
  productId,
  warehouseId,
}: {
  open: boolean;
  onClose: () => void;
  productId?: string;
  warehouseId?: string;
}) {
  const state = useWorkspace();
  const run = useCommand();
  const [error, setError] = useState('');

  const form = useForm({
    productId: productId ?? state.products[0]?.id ?? '',
    warehouseId: warehouseId ?? state.warehouses[0]?.id ?? '',
    direction: '1',
    quantity: '1',
    reason: '',
  });

  const current = stock(state, form.values.productId, form.values.warehouseId);

  const submit = () => {
    const failure = run(
      {
        type: 'inventory/adjust',
        productId: form.values.productId,
        warehouseId: form.values.warehouseId,
        quantity: (Number(form.values.quantity) || 0) * Number(form.values.direction),
        reason: form.values.reason.trim(),
      },
      'Stock adjustment posted.',
    );

    if (failure) {
      setError(failure);
      return;
    }
    setError('');
    track('inventory_adjusted');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Adjust stock"
      description="Adjustments post a movement. Nothing edits an on-hand figure directly."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Post adjustment
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Product" htmlFor="adjust-product">
            <Select
              id="adjust-product"
              value={form.values.productId}
              onChange={(event) => form.set('productId', event.target.value)}
            >
              {state.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} — {product.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Warehouse" htmlFor="adjust-warehouse">
            <Select
              id="adjust-warehouse"
              value={form.values.warehouseId}
              onChange={(event) => form.set('warehouseId', event.target.value)}
            >
              {state.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <p className="text-[0.8125rem] text-muted">
          Currently <span className="tabular-nums text-charcoal">{current.onHand}</span> on hand,{' '}
          <span className="tabular-nums text-charcoal">{current.allocated}</span> allocated,{' '}
          <span className="tabular-nums text-charcoal">{current.available}</span> available.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Direction" htmlFor="adjust-direction">
            <Select
              id="adjust-direction"
              value={form.values.direction}
              onChange={(event) => form.set('direction', event.target.value)}
            >
              <option value="1">Increase</option>
              <option value="-1">Decrease</option>
            </Select>
          </FormField>

          <FormField label="Quantity" htmlFor="adjust-quantity">
            <NumberInput
              id="adjust-quantity"
              min="1"
              value={form.values.quantity}
              onChange={(value) => form.set('quantity', value)}
            />
          </FormField>
        </div>

        <FormField label="Reason" htmlFor="adjust-reason">
          <TextInput
            id="adjust-reason"
            placeholder="Cycle count variance, damage, found stock…"
            value={form.values.reason}
            onChange={(event) => form.set('reason', event.target.value)}
          />
        </FormField>

        {error && (
          <p role="alert" className="text-[0.8125rem] text-app-danger">
            {error}
          </p>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Post
        </button>
      </form>
    </Dialog>
  );
}
