begin;

-- Les objets DayZ classiques restent limites a 1000 unites.
-- SenzanyBankCredit est une livraison virtuelle : quantity represente le montant bancaire.
alter table public.delivery_items
  drop constraint if exists delivery_items_quantity_check;

alter table public.delivery_items
  add constraint delivery_items_quantity_check
  check (
    (classname = 'SenzanyBankCredit' and quantity > 0 and quantity <= 100000000)
    or
    (classname <> 'SenzanyBankCredit' and quantity > 0 and quantity <= 1000)
  );

commit;
