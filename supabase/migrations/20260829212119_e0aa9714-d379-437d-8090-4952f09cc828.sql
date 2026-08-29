-- Guard order updates made through the Data API (customers and vendors).
CREATE OR REPLACE FUNCTION public.guard_order_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_vendor_owner boolean;
  old_rank int;
  new_rank int;
BEGIN
  -- Service role / superuser paths (webhook, admin jobs) are unrestricted.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Immutable commercial fields for every non-service caller.
  IF NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
     OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Order pricing and ownership cannot be modified';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = OLD.vendor_id AND v.owner_id = uid
  ) INTO is_vendor_owner;

  IF uid = OLD.user_id AND NOT is_vendor_owner THEN
    -- Customer path.
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      RAISE EXCEPTION 'Order quantity cannot be modified';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status <> 'pending_payment' OR NEW.status <> 'cancelled' THEN
        RAISE EXCEPTION 'Customers may only cancel an order that is awaiting payment';
      END IF;
    ELSIF OLD.status <> 'pending_payment' THEN
      -- Delivery/recipient details are only editable before payment.
      IF NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
         OR NEW.delivery_address IS DISTINCT FROM OLD.delivery_address
         OR NEW.delivery_city IS DISTINCT FROM OLD.delivery_city
         OR NEW.delivery_pincode IS DISTINCT FROM OLD.delivery_pincode
         OR NEW.delivery_date IS DISTINCT FROM OLD.delivery_date
         OR NEW.gift_message IS DISTINCT FROM OLD.gift_message
         OR NEW.reminder_id IS DISTINCT FROM OLD.reminder_id
         OR NEW.family_member_id IS DISTINCT FROM OLD.family_member_id THEN
        RAISE EXCEPTION 'Order details can only be edited while awaiting payment';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF is_vendor_owner THEN
    -- Vendor path: forward-only fulfilment progress.
    IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
      RAISE EXCEPTION 'Order quantity cannot be modified';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      old_rank := CASE OLD.status
        WHEN 'paid' THEN 1 WHEN 'confirmed' THEN 2
        WHEN 'out_for_delivery' THEN 3 WHEN 'delivered' THEN 4 ELSE 0 END;
      new_rank := CASE NEW.status
        WHEN 'paid' THEN 1 WHEN 'confirmed' THEN 2
        WHEN 'out_for_delivery' THEN 3 WHEN 'delivered' THEN 4 ELSE 0 END;
      IF old_rank = 0 OR new_rank = 0 OR new_rank <= old_rank THEN
        RAISE EXCEPTION 'Shops can only move a paid order forward through fulfilment';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to update this order';
END;
$$;

DROP TRIGGER IF EXISTS orders_guard_update ON public.orders;
CREATE TRIGGER orders_guard_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_update();

-- Shops must not be able to set their own rating.
CREATE OR REPLACE FUNCTION public.guard_vendor_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    RAISE EXCEPTION 'Shop rating is set by the system only';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo THEN
    RAISE EXCEPTION 'Shop ownership cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_guard_update ON public.vendors;
CREATE TRIGGER vendors_guard_update
BEFORE UPDATE ON public.vendors
FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_update();