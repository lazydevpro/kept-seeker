-- Two statements, not one. Crypto needs the terms and "not in a sanctioned region or the UK";
-- tokenized stocks and private-market tokens also need "not a U.S. person, not in Canada or
-- Australia", because their issuers forbid it. terms_version records the first; this records the
-- second, at the terms version it was made under.
ALTER TABLE profiles ADD COLUMN securities_terms_version INTEGER;

-- Everyone who agreed before this made the full statement, the only one there was.
UPDATE profiles SET securities_terms_version = terms_version WHERE terms_version IS NOT NULL;
