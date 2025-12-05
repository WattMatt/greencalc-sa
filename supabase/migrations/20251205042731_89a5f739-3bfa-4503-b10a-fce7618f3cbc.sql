-- Shop type categories/sectors for organizing load profiles
CREATE TABLE public.shop_type_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category reference to shop_types
ALTER TABLE public.shop_types ADD COLUMN category_id UUID REFERENCES public.shop_type_categories(id);

-- Enable RLS
ALTER TABLE public.shop_type_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shop_type_categories" ON public.shop_type_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can insert shop_type_categories" ON public.shop_type_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shop_type_categories" ON public.shop_type_categories FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete shop_type_categories" ON public.shop_type_categories FOR DELETE USING (true);

-- Seed default categories
INSERT INTO public.shop_type_categories (name, description, sort_order) VALUES
  ('Food & Beverage', 'Restaurants, cafes, fast food, bars', 1),
  ('Retail - Fashion', 'Clothing, footwear, accessories', 2),
  ('Retail - General', 'Department stores, variety stores', 3),
  ('Grocery & Supermarket', 'Food retail, convenience stores', 4),
  ('Services', 'Banks, salons, dry cleaners, medical', 5),
  ('Entertainment', 'Cinemas, arcades, fitness centers', 6),
  ('Electronics & Technology', 'Electronics, appliances, telecoms', 7),
  ('Home & Living', 'Furniture, homeware, decor', 8);