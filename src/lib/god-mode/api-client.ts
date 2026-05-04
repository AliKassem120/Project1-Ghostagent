export const fetchGodMode = async (endpoint: string, options?: RequestInit) => {
    const res = await fetch(`/api/god-mode/${endpoint}`, options);
    if (res.status === 403) {
        sessionStorage.removeItem('god_mode_auth');
        window.location.reload();
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json();
};
