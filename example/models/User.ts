export interface User {
    id: number;
    username: string;
    email: string;
    name: string;
    role: string;
    created_at: Date;
    updated_at: Date;
}

export interface UserCreateInput {
    username: string;
    email: string;
    name: string;
    role?: string;
}

export interface UserUpdateInput {
    username?: string;
    email?: string;
    name?: string;
    role?: string;
}
