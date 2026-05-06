-- ═══════════════════════════════════════════════════════════════
-- Fix: orders_status_check and appointments status CHECK constraints
-- ═══════════════════════════════════════════════════════════════
-- Root cause: cancelLatestOrder writes 'Cancelled' (title-case) but
-- the CHECK constraint only allowed a limited set of values.
-- This migration drops and recreates both constraints to accept
-- both lower-case and title-case variants.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Orders: drop old constraint and recreate with full set ──

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'Pending',    'pending',
        'Contacted',  'contacted',
        'Fulfilled',  'fulfilled',
        'Completed',  'completed',
        'Cancelled',  'cancelled',
        'Canceled',   'canceled'
    ));

-- ── 2. Appointments: drop old constraint and recreate ──────────

ALTER TABLE public.appointments
    DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN (
        'pending',    'Pending',
        'confirmed',  'Confirmed',
        'cancelled',  'Cancelled',
        'canceled',   'Canceled',
        'completed',  'Completed',
        'no_show',    'No Show'
    ));

-- ── 3. Stock decrement function (called by order creation) ────

CREATE OR REPLACE FUNCTION public.decrement_stock(
    p_product_id uuid,
    p_quantity integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.inventory
    SET stock_level = GREATEST(stock_level - p_quantity, 0)
    WHERE id = p_product_id;
END;
$$;

-- ── 4. Stock restore function (called on order cancellation) ──

CREATE OR REPLACE FUNCTION public.restore_stock(
    p_product_id uuid,
    p_quantity integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.inventory
    SET stock_level = stock_level + p_quantity
    WHERE id = p_product_id;
END;
$$;

-- ── 5. Reload PostgREST schema cache ───────────────────────────

NOTIFY pgrst, 'reload schema';
