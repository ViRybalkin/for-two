create or replace function add_inventory_item(
  p_display_name text,
  p_quantity numeric,
  p_unit base_unit,
  p_storage storage_location,
  p_expiry_date date default null,
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_product_id uuid;
  v_item_id uuid;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select id into v_household_id from households order by created_at limit 1;
  if v_household_id is null then raise exception 'Household not found'; end if;

  insert into products(normalized_name, display_name_ru, default_unit)
  values (lower(trim(p_display_name)), trim(p_display_name), p_unit)
  on conflict (normalized_name, default_unit)
  do update set display_name_ru = excluded.display_name_ru
  returning id into v_product_id;

  insert into inventory_items(household_id, product_id, quantity_base, base_unit, storage_location, nearest_expiry_date, source_type)
  values (v_household_id, v_product_id, p_quantity, p_unit, p_storage, p_expiry_date, 'manual')
  on conflict (household_id, product_id, storage_location, base_unit)
  do update set
    quantity_base = inventory_items.quantity_base + excluded.quantity_base,
    nearest_expiry_date = case
      when inventory_items.nearest_expiry_date is null then excluded.nearest_expiry_date
      when excluded.nearest_expiry_date is null then inventory_items.nearest_expiry_date
      else least(inventory_items.nearest_expiry_date, excluded.nearest_expiry_date)
    end,
    updated_at = now()
  returning id into v_item_id;

  insert into inventory_movements(inventory_item_id, operation, quantity_delta, idempotency_key)
  values (v_item_id, 'add', p_quantity, p_idempotency_key);
  return v_item_id;
end;
$$;

create or replace function adjust_inventory_item(
  p_item_id uuid,
  p_delta numeric,
  p_idempotency_key text default null
) returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quantity numeric;
begin
  if p_delta = 0 then raise exception 'Delta must not be zero'; end if;
  update inventory_items
  set quantity_base = quantity_base + p_delta, updated_at = now()
  where id = p_item_id and quantity_base + p_delta >= 0
  returning quantity_base into v_quantity;
  if v_quantity is null then raise exception 'Inventory item not found or quantity would be negative'; end if;
  insert into inventory_movements(inventory_item_id, operation, quantity_delta, idempotency_key)
  values (p_item_id, 'correct', p_delta, p_idempotency_key);
  return v_quantity;
end;
$$;

revoke all on function add_inventory_item(text,numeric,base_unit,storage_location,date,text) from public;
revoke all on function adjust_inventory_item(uuid,numeric,text) from public;
