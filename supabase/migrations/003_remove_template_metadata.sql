-- Template category/status are no longer part of the product model.
UPDATE public.templates
SET data = data - 'category' - 'status';
