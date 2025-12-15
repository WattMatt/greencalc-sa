-- Add share_token column for unique shareable links
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_proposals_share_token ON public.proposals(share_token);

-- Create a function to generate share tokens
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$;

-- Create RLS policy for public access via share_token
CREATE POLICY "Public can view proposals via share token" 
ON public.proposals 
FOR SELECT 
USING (share_token IS NOT NULL);

-- Create policy for public signature updates via share_token
CREATE POLICY "Clients can sign proposals via share token" 
ON public.proposals 
FOR UPDATE 
USING (share_token IS NOT NULL AND status = 'sent')
WITH CHECK (share_token IS NOT NULL);