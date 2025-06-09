export interface User {
    id?: number;
    username: string;
    email: string;
    password_hash?: string | null;
    name?: string | null;
    role?: string;
    created_at?: string;
    updated_at?: string;
}

export interface UserCreateInput {
    username: string;
    email: string;
    password_hash?: string;
    name?: string;
    role?: string;
}

export interface UserUpdateInput {
    username?: string;
    email?: string;
    password_hash?: string;
    name?: string;
    role?: string;
}
