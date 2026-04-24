-- Create user_song_preferences table
CREATE TABLE IF NOT EXISTS user_song_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    pdf_file_id INTEGER NOT NULL,
    transpose_amount INTEGER NOT NULL DEFAULT 0,
    capo_fret INTEGER NOT NULL DEFAULT 0,
    arrangement_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_song_preferences_pdf_files FOREIGN KEY (pdf_file_id) REFERENCES pdf_files(id) ON DELETE CASCADE
);

-- Indices for performance and uniqueness
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ix_user_song_preferences_user_id_pdf_file_id') THEN
        CREATE UNIQUE INDEX ix_user_song_preferences_user_id_pdf_file_id ON user_song_preferences(user_id, pdf_file_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ix_user_song_preferences_pdf_file_id') THEN
        CREATE INDEX ix_user_song_preferences_pdf_file_id ON user_song_preferences(pdf_file_id);
    END IF;
END $$;
