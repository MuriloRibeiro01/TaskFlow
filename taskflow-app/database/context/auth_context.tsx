// database/context/auth_context.ts
import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { SyncService } from "../sync/sync.service";
import { onLocalChange } from "../sync/sync_trigger";
import { logout, saveLocalUser } from "../services/session";
import { userAuthentication } from "../services/auth";
import { getSession, loginDev, onSessionExpired, type AuthUser } from "../api/client";

interface AuthContextData {
    user: AuthUser | null;
    // true apenas enquanto a sessão salva é restaurada na abertura do app
    isLoading: boolean;
    signIn: () => Promise<void>;
    signInAsGuest: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | null>(null);

const syncService = new SyncService();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Sessão salva no aparelho: abre logado mesmo offline
        getSession()
            .then(async (session) => {
                if (session) return setUser(session.user);
                // Demo local: com EXPO_PUBLIC_DEV_LOGIN_EMAIL no .env, entra sozinho (sem tela de login)
                const email = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL;
                if (!email) return;
                const dev = await loginDev(email);
                saveLocalUser(dev);
                setUser(dev);
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        // A API recusou o token (expirou): volta para o login
        return onSessionExpired(() => setUser(null));
    }, []);

    // Sincroniza com a API ao entrar, ao voltar para o app, ao reconectar e logo depois de cada
    // gravação local. O SyncService junta chamadas simultâneas, ignora as sem rede e registra os
    // erros no resultado (nunca lança).
    useEffect(() => {
        if (!user) return;

        const sync = () => { syncService.syncAll(); };
        sync();
        const appState = AppState.addEventListener("change", (state) => state === "active" && sync());
        const unsubscribeNet = NetInfo.addEventListener((state) => state.isConnected && sync());
        const unsubscribeChanges = onLocalChange(sync);

        return () => {
            appState.remove();
            unsubscribeNet();
            unsubscribeChanges();
        };
    }, [user?.id]);

    const signIn = async () => {
        const user = await userAuthentication();
        if (user) {
            setUser(user);
        }
    };

    const signInAsGuest = async () => {
        const user = await loginDev('guest@demo.com');
        setUser(user);
    };

    const signOut = async () => {
        await logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading: loading, signIn, signInAsGuest, signOut }}>
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
