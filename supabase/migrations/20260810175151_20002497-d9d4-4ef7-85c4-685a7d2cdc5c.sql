ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_type text NOT NULL DEFAULT 'SRE',
  ADD COLUMN IF NOT EXISTS cnh_categories text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cnh_issued_at date,
  ADD COLUMN IF NOT EXISTS cnh_expires_at date,
  ADD COLUMN IF NOT EXISTS cnh_first_at date,
  ADD COLUMN IF NOT EXISTS cnh_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_driver_type_check'
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_driver_type_check
      CHECK (driver_type IN ('SRE', 'AUTORIZADO', 'OUTRO'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_profile_id_key
  ON public.drivers(profile_id) WHERE profile_id IS NOT NULL;

UPDATE public.drivers
SET cnh_categories = string_to_array(upper(regexp_replace(license_category, '\s', '', 'g')), ',')
WHERE license_category IS NOT NULL
  AND cnh_categories = '{}'::text[];

ALTER TABLE public.vehicle_blocks
  ADD COLUMN IF NOT EXISTS expected_return_at timestamptz;