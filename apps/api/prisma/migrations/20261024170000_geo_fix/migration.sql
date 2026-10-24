-- The dataset spells the division "Chattagram" and its district "Chattogram". Use the official
-- spelling for both, so the checkout dropdowns read the same.
UPDATE divisions SET name_en = 'Chattogram' WHERE id = 1 AND name_en = 'Chattagram';
