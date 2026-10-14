// database/context/auth_context.ts
import React, { createContext, useContext, useEffect, useState } from "react";
import { logout, saveLocalUser } from "../services/session";
import { userAuthentication } from "../services/auth";
import { User } from "@supabase/supabase-js";
import { supabase } from "../supabase/supabase";

interface AuthContextData {
    user: User | null;
    // true apenas enquanto a sessão salva é restaurada na abertura do app
    isLoading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Emite INITIAL_SESSION (sessão salva no aparelho, funciona offline),
        // depois SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const sessionUser = session?.user ?? null;
                if (sessionUser) {
                    saveLocalUser(sessionUser);
                }
                setUser(sessionUser);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async () => {
        const user = await userAuthentication();
        if (user) {
            setUser(user);
        }
    };

    const signOut = async () => {
        await logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading: loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
};
