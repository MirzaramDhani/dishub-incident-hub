-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'petugas', 'admin');

-- Create report_status enum
CREATE TYPE public.report_status AS ENUM ('Open', 'On Progress', 'Resolved', 'Rejected');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  location_text TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  image_url TEXT,
  status public.report_status NOT NULL DEFAULT 'Open',
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create report_updates table
CREATE TABLE public.report_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  petugas_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  image_url TEXT,
  status_update public.report_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create storage bucket for report images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('report-images', 'report-images', true);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_updates ENABLE ROW LEVEL SECURITY;

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'User'), 'user');
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update report updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for reports updated_at
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles (for creating petugas)"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for categories
CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for reports
CREATE POLICY "Anyone authenticated can view reports"
  ON public.reports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON public.reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Petugas can update assigned reports"
  ON public.reports FOR UPDATE
  USING (
    -- allow any user with role 'petugas' to update reports that are either
    -- unassigned (assigned_to IS NULL) or assigned to a petugas account
    public.has_role(auth.uid(), 'petugas') AND (
      assigned_to IS NULL OR public.has_role(assigned_to, 'petugas')
    )
  );

CREATE POLICY "Admins can update any report"
  ON public.reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for report_updates
CREATE POLICY "Anyone authenticated can view report updates"
  ON public.report_updates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Petugas can create updates for reports assigned to Dishub (org-level)"
  ON public.report_updates FOR INSERT
  WITH CHECK (
    -- requester must be a petugas and the inserted "petugas_id" must be the
    -- authenticated user so we keep an audit of who created the update
    public.has_role(auth.uid(), 'petugas') AND
    petugas_id = auth.uid() AND
    -- allow inserts only for report IDs that refer to reports which are either
    -- unassigned (organization-level) or assigned to a petugas account. This
    -- keeps petugas as an organisation while preserving who performed the
    -- specific action via the petugas_id column.
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id AND (
        r.assigned_to IS NULL OR public.has_role(r.assigned_to, 'petugas')
      )
    )
  );

CREATE POLICY "Admins can create any update"
  ON public.report_updates FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage policies for report-images bucket
CREATE POLICY "Anyone can view report images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'report-images');

CREATE POLICY "Authenticated users can upload report images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'report-images' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'report-images' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can delete any image"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'report-images' AND 
    public.has_role(auth.uid(), 'admin')
  );

-- Insert default categories
INSERT INTO public.categories (name) VALUES
  ('Jalan Berlubang'),
  ('Pohon Tumbang'),
  ('Rambu Lalu Lintas Mati'),
  ('Lampu Jalan Padam'),
  ('Trotoar Rusak'),
  ('Banjir Lokal'),
  ('Drainase Tersumbat');