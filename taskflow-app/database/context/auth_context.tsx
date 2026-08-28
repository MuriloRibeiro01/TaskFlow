// database/context/auth_context.ts
import React, { createContext, useContext, useEffect, useState } from "react";
import { logout, restoreLocalUser } from "../services/session";
import { userAuthentication } from "../services/auth";
import { User } from "@supabase/supabase-js";
import { supabase } from "../supabase/supabase";

interface AuthContextData {
    user: User | null;
    isLoading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        try {
            const localUser = await restoreLocalUser();

            if (localUser) {
                setUser(localUser);
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                setUser(session?.user || null);
            }
        } catch (e) {
            console.log("Não foi possível autenticar:", e);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (session?.user) {
                    setUser(session.user);
                } else {
                    setUser(null);
                }
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async () => {
        try {
            setLoading(true);
            const user = await userAuthentication();
            if (user) {
                setUser(user);
            }
        } catch (e) {
            console.error("Erro ao fazer login:", e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setLoading(true);
            await logout();
            setUser(null);
        } catch (e) {
            console.error("Erro ao fazer logout:", e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    // ✅ CORRIGIDO: Usar loading em vez de isLoading (que era importado de expo-font)
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