CREATE TABLE storage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    provider VARCHAR(50) NOT NULL,
    item_id TEXT NOT NULL,          
    parent_provider_id TEXT,        
    item_type VARCHAR(10) NOT NULL CHECK (item_type IN ('file', 'folder')),
    item_name TEXT NOT NULL,
    item_size BIGINT NOT NULL,      
    
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    

    CONSTRAINT unique_provider_item 
        UNIQUE(provider, item_id),


    CONSTRAINT unique_item_in_parent
        UNIQUE(user_id, provider, parent_provider_id, item_name)
);