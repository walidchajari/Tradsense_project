import { useQuery } from '@tanstack/react-query';

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';
export const API_BASE_URL = RAW_API_BASE_URL.endsWith('/api')
    ? RAW_API_BASE_URL
    : `${RAW_API_BASE_URL.replace(/\/$/, '')}/api`;

// --- Fetcher Functions ---

const getAuthToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
};

const fetchFromApi = async (endpoint: string) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) {
        console.error(`Error fetching ${endpoint}: ${response.statusText}`);
        throw new Error(`Failed to fetch ${endpoint}`);
    }
    const data = await response.json();
    return data || [];
};

const postToApi = async (endpoint: string, body: object) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        console.error(`Error posting to ${endpoint}: ${response.statusText}`);
        throw new Error(`Failed to post to ${endpoint}`);
    }
    return response.json();
}

const putToApi = async (endpoint: string, body: object) => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        console.error(`Error putting to ${endpoint}: ${response.statusText}`);
        throw new Error(`Failed to put to ${endpoint}`);
    }
    return response.json();
}

const buildQueryString = (params: Record<string, string | number | boolean | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        search.set(key, String(value));
    });
    const query = search.toString();
    return query ? `?${query}` : '';
};

const getMarketOverview = (accountId?: number) => {
    const query = buildQueryString({ account_id: accountId });
    return fetchFromApi(`/market-overview${query}`);
};
const getAccountStats = (userId: number) => fetchFromApi(`/accounts/${userId}`);
const getPortfolio = (userId: number) => fetchFromApi(`/portfolio/${userId}`);
const getMarketPulse = (accountId?: number) => {
    const query = buildQueryString({ account_id: accountId });
    return fetchFromApi(`/market-pulse${query}`);
};
const getMarketHistory = (symbols: string[], points: number, accountId?: number) => {
    const query = buildQueryString({ symbols: symbols.join(','), points, account_id: accountId });
    return fetchFromApi(`/market-history${query}`);
};
const getNews = () => fetchFromApi('/news');
const getChallenges = () => fetchFromApi('/challenges');
const getUserChallenges = (userId: number) => fetchFromApi(`/user-challenges/${userId}`);
const getPaymentHistory = (userId: number) => fetchFromApi(`/payments/${userId}`);
const getAISignals = (accountId?: number) => {
    const query = buildQueryString({ account_id: accountId });
    return fetchFromApi(`/ai/signals${query}`);
};
const getAIPrediction = (symbol: string, accountId?: number) => {
    const query = buildQueryString({ account_id: accountId });
    return fetchFromApi(`/ai/predict/${symbol}${query}`);
};
const getCasablancaCompanies = (params?: { query?: string; limit?: number; offset?: number; minimal?: boolean; accountId?: number }) => {
    const query = params?.query?.trim();
    const endpoint = query ? '/casablanca/companies/search' : '/casablanca/companies';
    const queryString = buildQueryString({
        query: query || undefined,
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
        minimal: params?.minimal ?? true,
        account_id: params?.accountId,
    });
    return fetchFromApi(`${endpoint}${queryString}`);
};
const postContactMessage = (payload: { name: string; email: string; subject?: string; message: string }) =>
    postToApi('/contact', payload);


// --- React Query Hooks ---

export const useMarketOverviewQuery = (accountId?: number, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['marketOverview', accountId],
        queryFn: () => getMarketOverview(accountId),
        enabled,
        refetchInterval: 30000, // 30 seconds
    });
};

export const useAccountStatsQuery = (userId: number) => {
    return useQuery({
        queryKey: ['accountStats', userId],
        queryFn: () => getAccountStats(userId),
        enabled: !!userId,
        refetchInterval: 30000, // 30 seconds
    });
};

export const usePortfolioQuery = (userId: number) => {
    return useQuery({
        queryKey: ['portfolio', userId],
        queryFn: () => getPortfolio(userId),
        enabled: !!userId,
        refetchInterval: 15000,
    });
};

export const useMarketPulseQuery = (accountId?: number, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['marketPulse', accountId],
        queryFn: () => getMarketPulse(accountId),
        enabled,
        refetchInterval: 8000,
    });
};

export const useMarketHistoryQuery = (symbols: string[], points: number = 20, accountId?: number, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['marketHistory', symbols.join(','), points, accountId],
        queryFn: () => getMarketHistory(symbols, points, accountId),
        enabled: enabled && symbols.length > 0,
        refetchInterval: 20000,
    });
};

export const useNewsQuery = () => {
    return useQuery({
        queryKey: ['news'],
        queryFn: getNews,
        refetchInterval: 60000,
    });
};

export const useChallengesQuery = () => {
    return useQuery({
        queryKey: ['challenges'],
        queryFn: getChallenges,
    });
};

export const useUserChallengesQuery = (userId: number) => {
    return useQuery({
        queryKey: ['userChallenges', userId],
        queryFn: () => getUserChallenges(userId),
        enabled: !!userId,
    });
};

export const usePaymentHistoryQuery = (userId: number) => {
    return useQuery({
        queryKey: ['paymentHistory', userId],
        queryFn: () => getPaymentHistory(userId),
        enabled: !!userId,
    });
};

export const useAISignalsQuery = (accountId?: number, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['aiSignals', accountId],
        queryFn: () => getAISignals(accountId),
        enabled,
        refetchInterval: 60000,
    });
};

export const useAIPredictionQuery = (symbol: string, accountId?: number, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['aiPrediction', symbol, accountId],
        queryFn: () => getAIPrediction(symbol, accountId),
        enabled: !!symbol && enabled,
    });
};

export const useCasablancaCompaniesQuery = (params?: { query?: string; limit?: number; offset?: number; minimal?: boolean; accountId?: number }) => {
    const query = params?.query?.trim();
    return useQuery({
        queryKey: ['casablancaCompanies', query || '', params?.limit ?? 50, params?.offset ?? 0, params?.minimal ?? true, params?.accountId],
        queryFn: () => getCasablancaCompanies(params),
        refetchInterval: 10000,
    });
};

export const submitContactMessage = (payload: { name: string; email: string; subject?: string; message: string }) =>
    postContactMessage(payload);

// --- Convenience Hooks (shape expected by pages) ---

export const useMarketOverview = (accountId?: number, enabled: boolean = true) => {
    const query = useMarketOverviewQuery(accountId, enabled);
    return { assets: query.data || [], ...query };
};

export const useAccountStats = (userId: number) => {
    const query = useAccountStatsQuery(userId);
    const account = Array.isArray(query.data) ? query.data[0] : undefined;
    return { account, ...query };
};

export const usePortfolio = (userId: number) => {
    const query = usePortfolioQuery(userId);
    return { portfolio: query.data || null, ...query };
};

export const useMarketPulse = (accountId?: number, enabled: boolean = true) => {
    const query = useMarketPulseQuery(accountId, enabled);
    return { pulse: query.data || null, ...query };
};

export const useMarketHistory = (symbols: string[], points: number = 20, accountId?: number, enabled: boolean = true) => {
    const query = useMarketHistoryQuery(symbols, points, accountId, enabled);
    return { history: query.data || {}, ...query };
};

export const useNews = () => {
    const query = useNewsQuery();
    return { news: query.data || [], ...query };
};

export const useChallenges = () => {
    const query = useChallengesQuery();
    return { challenges: query.data || [], ...query };
};

export const useUserChallenges = (userId: number) => {
    const query = useUserChallengesQuery(userId);
    return { userChallenges: query.data || [], ...query };
};

export const usePaymentHistory = (userId: number) => {
    const query = usePaymentHistoryQuery(userId);
    return { payments: query.data || [], ...query };
};

export const useAISignals = (accountId?: number, enabled: boolean = true) => {
    const query = useAISignalsQuery(accountId, enabled);
    return { signals: query.data || [], ...query };
};

export const useCasablancaCompanies = (params?: { query?: string; limit?: number; offset?: number; minimal?: boolean; accountId?: number }) => {
    const query = useCasablancaCompaniesQuery(params);
    return { companies: query.data?.items || [], status: query.data?.status || 'unknown', ...query };
};

// --- Mutation Functions ---

export const executeTrade = (tradeData: {
    account_id: number;
    asset: string;
    side: string;
    quantity: number;
    price: number;
    market?: string;
    take_profit?: number;
    stop_loss?: number;
}) => {
    return postToApi('/trade', tradeData);
};

export const processPayment = (userId: number, challengeId: number) => {
    return postToApi('/pay', { user_id: userId, challenge_id: challengeId });
};

export const registerUser = (payload: { username: string; email: string; password: string; account_type?: string; plan?: string }) => {
    return postToApi('/auth/register', payload);
};

export const loginUser = (payload: { email: string; password: string }) => {
    return postToApi('/auth/login', payload);
};

export const requestWithdrawal = (payload: { account_id: number; amount: number }) => {
    return postToApi('/withdrawals/request', payload);
};

export const loginWithGoogle = (payload: { id_token: string; account_type?: string; plan?: string }) => {
    return postToApi('/auth/google', payload);
};
