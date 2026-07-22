-- AutoPay/AutoPost concept removed from the app: every bill payment now
-- requires an explicit human "Mark as Paid" confirmation. These columns are
-- left in place (not dropped) so the rollout is reversible and no historical
-- data is destroyed; a later migration can drop them once this has baked.
comment on column public.bills.auto_post is 'DEPRECATED — auto-post engine removed; column kept for now, not read/written by app code.';
comment on column public.bills.autopay is 'DEPRECATED — cosmetic flag removed from UI; column kept for now, not read/written by app code.';
