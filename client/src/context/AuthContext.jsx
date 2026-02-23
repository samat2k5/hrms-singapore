import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // New Feature: Entity Context Switching
    const [entities, setEntities] = useState([]);
    const [activeEntity, setActiveEntity] = useState(null);

    useEffect(() => {
        const savedToken = localStorage.getItem('hrms_token');
        const savedUser = localStorage.getItem('hrms_user');
        const savedEntity = localStorage.getItem('hrms_entity');

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            if (savedEntity) {
                setActiveEntity(JSON.parse(savedEntity));
            }
        }
        setLoading(false);
    }, []);

    const login = (authToken, userData) => {
        localStorage.setItem('hrms_token', authToken);
        localStorage.setItem('hrms_user', JSON.stringify(userData));
        setToken(authToken);
        setUser(userData);
        // Do not set entity immediately on login; wait for the dashboard to redirect or fetch entities
    };

    const logout = () => {
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_user');
        localStorage.removeItem('hrms_entity');

        setToken(null);
        setUser(null);
        setActiveEntity(null);
        setEntities([]);
    };

    const switchEntity = (entity) => {
        localStorage.setItem('hrms_entity', JSON.stringify(entity));
        setActiveEntity(entity);
    };

    // Derived values for convenience
    const role = activeEntity?.role;
    let managedGroups = [];
    if (activeEntity?.managed_groups) {
        try {
            managedGroups = typeof activeEntity.managed_groups === 'string'
                ? JSON.parse(activeEntity.managed_groups)
                : activeEntity.managed_groups;
        } catch (e) {
            managedGroups = [];
        }
    }

    return (
        <AuthContext.Provider value={{
            user, token, loading, login, logout, isAuthenticated: !!token,
            entities, setEntities, activeEntity, switchEntity,
            role, managedGroups
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be within AuthProvider');
    return context;
}
