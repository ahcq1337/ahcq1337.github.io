import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';

// Context for Firebase and User data
const AppContext = createContext(null);

// Custom hook to use the AppContext
const useAppContext = () => useContext(AppContext);

// Avatar placeholder function
const getAvatarPlaceholder = (seed) => {
    // A simple way to get a consistent placeholder image for a given seed (e.g., username or channel name)
    // In a real app, you might use a service like DiceBear or generate SVG avatars.
    const colors = ['#FFC0CB', '#ADD8E6', '#90EE90', '#FFD700', '#FFA07A', '#B0C4DE'];
    const hashCode = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hash;
    };
    const index = Math.abs(hashCode(seed)) % colors.length;
    const bgColor = colors[index];
    const textColor = '#FFFFFF';
    return `https://placehold.co/50x50/${bgColor.substring(1)}/${textColor.substring(1)}?text=${seed.substring(0, 2).toUpperCase()}`;
};

// Main App Component
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null); // Firebase User object
    const [userProfile, setUserProfile] = useState(null); // Custom user profile from Firestore
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState('auth'); // 'auth', 'home', 'createChannel', 'joinChannel', 'chat'
    const [selectedChannelId, setSelectedChannelId] = useState(null);
    const [message, setMessage] = useState(''); // For general messages to the user

    // Firebase Initialization and Auth State Listener
    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

        if (!Object.keys(firebaseConfig).length) {
            console.error("Firebase config is missing!");
            setLoading(false);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                    // Fetch user profile from Firestore
                    const userProfileRef = doc(firestoreDb, `artifacts/${appId}/users/${currentUser.uid}/profiles`, currentUser.uid);
                    const userProfileSnap = await getDoc(userProfileRef);
                    if (userProfileSnap.exists()) {
                        setUserProfile(userProfileSnap.data());
                        setCurrentPage('home');
                    } else {
                        // User exists in Auth but not in profile. This shouldn't happen if signup is handled correctly.
                        // Force them to complete profile or logout.
                        console.warn("User profile not found, redirecting to profile setup or logout.");
                        setCurrentPage('auth'); // Or a dedicated profile setup page
                        await signOut(firebaseAuth); // Log out and force re-auth
                    }
                } else {
                    setUser(null);
                    setUserProfile(null);
                    setCurrentPage('auth');
                }
                setLoading(false);
            });

            // Attempt to sign in with custom token if available
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (initialAuthToken) {
                signInWithCustomToken(firebaseAuth, initialAuthToken)
                    .catch((error) => {
                        console.error("Error signing in with custom token:", error);
                        signInAnonymously(firebaseAuth)
                            .catch((anonError) => console.error("Error signing in anonymously:", anonError));
                    });
            } else {
                signInAnonymously(firebaseAuth)
                    .catch((anonError) => console.error("Error signing in anonymously:", anonError));
            }

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            setMessage(`Erreur d'initialisation de Firebase: ${error.message}`);
            setLoading(false);
        }
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
            setCurrentPage('auth');
            setMessage('Déconnexion réussie.');
        } catch (error) {
            console.error("Error signing out:", error);
            setMessage(`Erreur lors de la déconnexion: ${error.message}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <div className="text-xl font-semibold">Chargement de l'application...</div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ db, auth, user, userProfile, setUserProfile, setCurrentPage, selectedChannelId, setSelectedChannelId, getAvatarPlaceholder, setMessage }}>
            <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter">
                {message && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-down">
                        {message}
                    </div>
                )}
                {userProfile && currentPage !== 'auth' && (
                    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-md rounded-b-lg">
                        <div className="flex items-center space-x-3">
                            <img src={userProfile.avatarUrl || getAvatarPlaceholder(userProfile.username)} alt="Avatar utilisateur" className="w-10 h-10 rounded-full border-2 border-blue-500" />
                            <span className="font-semibold text-lg">{userProfile.displayName}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">({userProfile.username})</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">ID: {user.uid}</span>
                        </div>
                        <nav className="flex space-x-4">
                            <button onClick={() => setCurrentPage('home')} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md">
                                Accueil
                            </button>
                            <button onClick={handleSignOut} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-md">
                                Déconnexion
                            </button>
                        </nav>
                    </header>
                )}

                <main className="flex-grow flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
                        {currentPage === 'auth' && <AuthPage />}
                        {currentPage === 'home' && <HomePage />}
                        {currentPage === 'createChannel' && <CreateChannelPage />}
                        {currentPage === 'joinChannel' && <JoinChannelPage />}
                        {currentPage === 'chat' && selectedChannelId && <ChatPage channelId={selectedChannelId} />}
                        {currentPage === 'userProfileSettings' && <UserProfileSettings />}
                    </div>
                </main>
            </div>
        </AppContext.Provider>
    );
};

// Auth Page Component (Login/Signup)
const AuthPage = () => {
    const { auth, db, setUserProfile, setCurrentPage, getAvatarPlaceholder, setMessage } = useAppContext();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loadingAuth, setLoadingAuth] = useState(false);

    // Username validation regex: 2-16 chars, alphanumeric, '.', '_'. Not just '.' or '_'.
    const usernameRegex = /^(?!^[._]+$)([a-zA-Z0-9._]{2,16})$/;

    const validateUsername = (name) => {
        if (!usernameRegex.test(name)) {
            setMessage("Le pseudo doit contenir entre 2 et 16 caractères alphanumériques, '.', ou '_'. Il ne peut pas être composé uniquement de '.' ou '_'.");
            return false;
        }
        return true;
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoadingAuth(true);
        setMessage('');

        if (!validateUsername(username)) {
            setLoadingAuth(false);
            return;
        }

        try {
            // Check if username already exists for signup
            if (!isLogin) {
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const profilesRef = collection(db, `artifacts/${appId}/users`);
                const q = query(profilesRef, where("username", "==", username));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setMessage("Ce pseudo est déjà pris. Veuillez en choisir un autre.");
                    setLoadingAuth(false);
                    return;
                }
            }

            let userCredential;
            if (isLogin) {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
                const userProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profiles`, user.uid);
                const newProfile = {
                    uid: user.uid,
                    username: username,
                    displayName: displayName || username, // Default display name to username
                    avatarUrl: getAvatarPlaceholder(username),
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                };
                await setDoc(userProfileRef, newProfile);
                setUserProfile(newProfile); // Update context with new profile
            }
            setMessage(isLogin ? "Connexion réussie !" : "Compte créé et connexion réussie !");
            setCurrentPage('home'); // Redirect to home on successful auth
        } catch (error) {
            console.error("Auth error:", error);
            let errorMessage = "Une erreur est survenue lors de l'authentification.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "Cette adresse e-mail est déjà utilisée.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Adresse e-mail invalide.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Le mot de passe doit contenir au moins 6 caractères.";
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = "Pseudo ou mot de passe incorrect.";
            }
            setMessage(errorMessage);
        } finally {
            setLoadingAuth(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">{isLogin ? "Se Connecter" : "Créer un Compte"}</h2>
            <form onSubmit={handleAuth} className="w-full max-w-md space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mot de Passe</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                </div>
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pseudo</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Entre 2 et 16 caractères (alphanumériques, ., _). Ne peut pas être uniquement '.' ou '_'.</p>
                </div>
                {!isLogin && (
                    <div>
                        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pseudo d'affichage (Optionnel)</label>
                        <input
                            type="text"
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                        />
                    </div>
                )}
                <button
                    type="submit"
                    disabled={loadingAuth}
                    className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                    {loadingAuth ? "Chargement..." : (isLogin ? "Se Connecter" : "S'inscrire")}
                </button>
            </form>
            <button
                onClick={() => setIsLogin(!isLogin)}
                className="mt-4 text-blue-600 hover:underline dark:text-blue-400"
            >
                {isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            </button>
        </div>
    );
};

// Home Page Component
const HomePage = () => {
    const { user, userProfile, setCurrentPage, setSelectedChannelId, db, setMessage } = useAppContext();
    const [joinedChannels, setJoinedChannels] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loadingChannels, setLoadingChannels] = useState(true);

    useEffect(() => {
        if (!db || !user) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        // Listen for channels the user is a member of
        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/channels`);
        const q = query(membersCollectionRef, where('members', 'array-contains', user.uid));

        const unsubscribeChannels = onSnapshot(q, async (snapshot) => {
            const channelsData = [];
            const pendingReqs = [];
            for (const docSnapshot of snapshot.docs) {
                const channelData = docSnapshot.data();
                const channelId = docSnapshot.id;

                // Fetch channel details
                const channelDocRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);
                const channelSnap = await getDoc(channelDocRef);

                if (channelSnap.exists()) {
                    const fullChannelData = { id: channelSnap.id, ...channelSnap.data() };

                    // Check user's membership status
                    const memberDocRef = doc(db, `artifacts/${appId}/public/data/channels/${channelId}/members`, user.uid);
                    const memberSnap = await getDoc(memberDocRef);
                    if (memberSnap.exists() && memberSnap.data().status === 'approved') {
                        channelsData.push(fullChannelData);
                    } else if (memberSnap.exists() && memberSnap.data().status === 'pending') {
                        pendingReqs.push(fullChannelData);
                    }
                }
            }
            setJoinedChannels(channelsData);
            setPendingRequests(pendingReqs);
            setLoadingChannels(false);
        }, (error) => {
            console.error("Error fetching joined channels:", error);
            setMessage(`Erreur lors du chargement des canaux: ${error.message}`);
            setLoadingChannels(false);
        });

        return () => unsubscribeChannels();
    }, [db, user, setMessage]);

    const handleJoinChat = (channelId) => {
        setSelectedChannelId(channelId);
        setCurrentPage('chat');
    };

    const handleApproveRequest = async (channelId, memberUid) => {
        if (!db || !user) return;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        try {
            const channelDocRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);
            const channelSnap = await getDoc(channelDocRef);

            if (channelSnap.exists() && channelSnap.data().adminId === user.uid) { // Only admin can approve
                const memberDocRef = doc(db, `artifacts/${appId}/public/data/channels/${channelId}/members`, memberUid);
                await updateDoc(memberDocRef, { status: 'approved' });

                // Also add the user's UID to the 'members' array in the channel document itself
                await updateDoc(channelDocRef, {
                    members: arrayUnion(memberUid)
                });

                setMessage(`Demande d'adhésion approuvée pour le canal ${channelSnap.data().name}.`);
            } else {
                setMessage("Vous n'êtes pas l'administrateur de ce canal ou le canal n'existe pas.");
            }
        } catch (error) {
            console.error("Error approving request:", error);
            setMessage(`Erreur lors de l'approbation de la demande: ${error.message}`);
        }
    };

    const handleRejectRequest = async (channelId, memberUid) => {
        if (!db || !user) return;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        try {
            const channelDocRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);
            const channelSnap = await getDoc(channelDocRef);

            if (channelSnap.exists() && channelSnap.data().adminId === user.uid) { // Only admin can reject
                const memberDocRef = doc(db, `artifacts/${appId}/public/data/channels/${channelId}/members`, memberUid);
                await updateDoc(memberDocRef, { status: 'rejected' }); // Or delete the document

                // Remove the user's UID from the 'members' array in the channel document itself
                await updateDoc(channelDocRef, {
                    members: arrayRemove(memberUid)
                });

                setMessage(`Demande d'adhésion rejetée pour le canal ${channelSnap.data().name}.`);
            } else {
                setMessage("Vous n'êtes pas l'administrateur de ce canal ou le canal n'existe pas.");
            }
        } catch (error) {
            console.error("Error rejecting request:", error);
            setMessage(`Erreur lors du rejet de la demande: ${error.message}`);
        }
    };

    if (loadingChannels) {
        return <div className="text-center py-8">Chargement des canaux...</div>;
    }

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Bienvenue, {userProfile?.displayName || userProfile?.username}!</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <button
                    onClick={() => setCurrentPage('createChannel')}
                    className="flex items-center justify-center px-6 py-4 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors"
                >
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Créer un Canal
                </button>
                <button
                    onClick={() => setCurrentPage('joinChannel')}
                    className="flex items-center justify-center px-6 py-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 transition-colors"
                >
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Rejoindre un Canal
                </button>
            </div>

            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Vos Canaux</h3>
            {joinedChannels.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">Vous n'avez pas encore rejoint de canaux.</p>
            ) : (
                <ul className="space-y-4">
                    {joinedChannels.map((channel) => (
                        <li key={channel.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm">
                            <div className="flex items-center space-x-3">
                                <img src={channel.avatarUrl || getAvatarPlaceholder(channel.name)} alt="Avatar canal" className="w-10 h-10 rounded-full border-2 border-gray-300" />
                                <span className="font-semibold text-lg">{channel.name}</span>
                                {channel.isPrivate && <span className="text-sm px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full">Privé</span>}
                            </div>
                            <button
                                onClick={() => handleJoinChat(channel.id)}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
                            >
                                Entrer
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <h3 className="text-xl font-semibold mt-8 mb-4 text-gray-900 dark:text-gray-100">Demandes d'adhésion en attente (pour vos canaux administrés)</h3>
            {pendingRequests.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">Aucune demande en attente.</p>
            ) : (
                <ul className="space-y-4">
                    {pendingRequests.map((channel) => (
                        <li key={channel.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm">
                            <div className="flex items-center space-x-3 mb-2 md:mb-0">
                                <img src={channel.avatarUrl || getAvatarPlaceholder(channel.name)} alt="Avatar canal" className="w-10 h-10 rounded-full border-2 border-gray-300" />
                                <span className="font-semibold text-lg">{channel.name}</span>
                                <span className="text-sm px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full">En attente</span>
                            </div>
                            <div className="flex space-x-2">
                                {/* This part needs to fetch actual pending members, not just the channel itself */}
                                {/* For simplicity, I'm assuming 'pendingRequests' here means channels you own that have pending requests.
                                    A more robust solution would list specific user requests. */}
                                <button
                                    onClick={() => handleJoinChat(channel.id)} // View channel to see pending members
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
                                >
                                    Voir les demandes
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-8">
                <button
                    onClick={() => setCurrentPage('userProfileSettings')}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                    Modifier le profil
                </button>
            </div>
        </div>
    );
};

// Create Channel Page Component
const CreateChannelPage = () => {
    const { db, user, setCurrentPage, getAvatarPlaceholder, setMessage } = useAppContext();
    const [channelName, setChannelName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [loadingCreate, setLoadingCreate] = useState(false);

    // Channel name validation regex: 2-16 chars, alphanumeric only.
    const channelNameRegex = /^[a-zA-Z0-9]{2,16}$/;

    const handleCreateChannel = async (e) => {
        e.preventDefault();
        setLoadingCreate(true);
        setMessage('');

        if (!channelNameRegex.test(channelName)) {
            setMessage("Le nom du canal doit contenir entre 2 et 16 caractères alphanumériques (pas de caractères spéciaux, d'espaces, de points ou de tirets du bas).");
            setLoadingCreate(false);
            return;
        }

        if (!db || !user) {
            setMessage("Utilisateur non authentifié ou base de données non disponible.");
            setLoadingCreate(false);
            return;
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        try {
            // Check if channel name already exists
            const channelsRef = collection(db, `artifacts/${appId}/public/data/channels`);
            const q = query(channelsRef, where("name", "==", channelName));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setMessage("Ce nom de canal existe déjà. Veuillez en choisir un autre.");
                setLoadingCreate(false);
                return;
            }

            const newChannel = {
                name: channelName,
                isPrivate: isPrivate,
                avatarUrl: getAvatarPlaceholder(channelName),
                createdAt: new Date().toISOString(),
                adminId: user.uid, // Creator is the admin
                members: [user.uid] // Add creator as a member immediately
            };

            const docRef = await addDoc(channelsRef, newChannel);

            // Add creator to the members subcollection with 'approved' status
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/channels/${docRef.id}/members`, user.uid);
            await setDoc(memberDocRef, {
                uid: user.uid,
                role: 'admin',
                status: 'approved',
                joinedAt: new Date().toISOString()
            });

            setMessage(`Canal "${channelName}" créé avec succès !`);
            setCurrentPage('home');
        } catch (error) {
            console.error("Error creating channel:", error);
            setMessage(`Erreur lors de la création du canal: ${error.message}`);
        } finally {
            setLoadingCreate(false);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Créer un Nouveau Canal</h2>
            <form onSubmit={handleCreateChannel} className="space-y-4">
                <div>
                    <label htmlFor="channelName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom du Canal</label>
                    <input
                        type="text"
                        id="channelName"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Entre 2 et 16 caractères (alphanumériques uniquement).</p>
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="isPrivate"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <label htmlFor="isPrivate" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Canal Privé</label>
                </div>
                <button
                    type="submit"
                    disabled={loadingCreate}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                    {loadingCreate ? "Création..." : "Créer le Canal"}
                </button>
                <button
                    type="button"
                    onClick={() => setCurrentPage('home')}
                    className="ml-4 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                    Annuler
                </button>
            </form>
        </div>
    );
};

// Join Channel Page Component
const JoinChannelPage = () => {
    const { db, user, setCurrentPage, setSelectedChannelId, setMessage } = useAppContext();
    const [channelName, setChannelName] = useState('');
    const [loadingJoin, setLoadingJoin] = useState(false);

    const handleJoinChannel = async (e) => {
        e.preventDefault();
        setLoadingJoin(true);
        setMessage('');

        if (!db || !user) {
            setMessage("Utilisateur non authentifié ou base de données non disponible.");
            setLoadingJoin(false);
            return;
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        try {
            const channelsRef = collection(db, `artifacts/${appId}/public/data/channels`);
            const q = query(channelsRef, where("name", "==", channelName));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setMessage("Canal introuvable.");
                setLoadingJoin(false);
                return;
            }

            const channelDoc = querySnapshot.docs[0];
            const channelData = channelDoc.data();
            const channelId = channelDoc.id;

            // Check if user is already a member or has a pending request
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/channels/${channelId}/members`, user.uid);
            const memberSnap = await getDoc(memberDocRef);

            if (memberSnap.exists()) {
                const memberStatus = memberSnap.data().status;
                if (memberStatus === 'approved') {
                    setMessage("Vous êtes déjà membre de ce canal.");
                    setSelectedChannelId(channelId);
                    setCurrentPage('chat');
                    setLoadingJoin(false);
                    return;
                } else if (memberStatus === 'pending') {
                    setMessage("Votre demande d'adhésion est déjà en attente pour ce canal.");
                    setLoadingJoin(false);
                    return;
                }
            }

            if (channelData.isPrivate) {
                // For private channels, add to members subcollection with 'pending' status
                await setDoc(memberDocRef, {
                    uid: user.uid,
                    role: 'member',
                    status: 'pending',
                    joinedAt: new Date().toISOString()
                });
                setMessage("Demande d'adhésion envoyée. En attente d'approbation de l'administrateur.");
            } else {
                // For public channels, add directly with 'approved' status and update channel's members array
                await setDoc(memberDocRef, {
                    uid: user.uid,
                    role: 'member',
                    status: 'approved',
                    joinedAt: new Date().toISOString()
                });
                await updateDoc(doc(db, `artifacts/${appId}/public/data/channels`, channelId), {
                    members: arrayUnion(user.uid)
                });
                setMessage(`Vous avez rejoint le canal "${channelName}" !`);
                setSelectedChannelId(channelId);
                setCurrentPage('chat');
            }
        } catch (error) {
            console.error("Error joining channel:", error);
            setMessage(`Erreur lors de l'adhésion au canal: ${error.message}`);
        } finally {
            setLoadingJoin(false);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Rejoindre un Canal</h2>
            <form onSubmit={handleJoinChannel} className="space-y-4">
                <div>
                    <label htmlFor="channelName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nom du Canal</label>
                    <input
                        type="text"
                        id="channelName"
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loadingJoin}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                    {loadingJoin ? "Rejoindre..." : "Rejoindre le Canal"}
                </button>
                <button
                    type="button"
                    onClick={() => setCurrentPage('home')}
                    className="ml-4 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                    Annuler
                </button>
            </form>
        </div>
    );
};

// Chat Page Component
const ChatPage = ({ channelId }) => {
    const { db, user, userProfile, setCurrentPage, getAvatarPlaceholder, setMessage } = useAppContext();
    const [channel, setChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loadingChat, setLoadingChat] = useState(true);
    const [pendingMembers, setPendingMembers] = useState([]);

    useEffect(() => {
        if (!db || !channelId || !user) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const channelDocRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);
        const messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/channels/${channelId}/messages`);
        const membersCollectionRef = collection(db, `artifacts/${appId}/public/data/channels/${channelId}/members`);

        // Listen for channel details
        const unsubscribeChannel = onSnapshot(channelDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const currentChannel = { id: docSnap.id, ...docSnap.data() };
                setChannel(currentChannel);

                // Check if the current user is an admin of this channel
                if (currentChannel.adminId === user.uid) {
                    // Fetch pending members if the current user is the admin
                    const q = query(membersCollectionRef, where('status', '==', 'pending'));
                    const unsubscribePending = onSnapshot(q, (snapshot) => {
                        const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setPendingMembers(pending);
                    }, (error) => console.error("Error fetching pending members:", error));
                    return () => unsubscribePending();
                } else {
                    setPendingMembers([]); // Not an admin, no pending members to show
                }
            } else {
                setMessage("Canal introuvable.");
                setCurrentPage('home');
            }
            setLoadingChat(false);
        }, (error) => {
            console.error("Error fetching channel:", error);
            setMessage(`Erreur lors du chargement du canal: ${error.message}`);
            setLoadingChat(false);
        });

        // Listen for messages
        const unsubscribeMessages = onSnapshot(query(messagesCollectionRef), (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort by timestamp
            setMessages(msgs);
        }, (error) => {
            console.error("Error fetching messages:", error);
            setMessage(`Erreur lors du chargement des messages: ${error.message}`);
        });

        return () => {
            unsubscribeChannel();
            unsubscribeMessages();
        };
    }, [db, channelId, user, setCurrentPage, setMessage]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !db || !user || !userProfile || !channelId) return;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const messagesCollectionRef = collection(db, `artifacts/${appId}/public/data/channels/${channelId}/messages`);

        try {
            await addDoc(messagesCollectionRef, {
                senderId: user.uid,
                senderDisplayName: userProfile.displayName,
                senderAvatarUrl: userProfile.avatarUrl,
                text: newMessage,
                timestamp: new Date().toISOString(),
            });
            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
            setMessage(`Erreur lors de l'envoi du message: ${error.message}`);
        }
    };

    const handleApproveMember = async (memberUid) => {
        if (!db || !user || !channel) return;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        try {
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/channels/${channelId}/members`, memberUid);
            await updateDoc(memberDocRef, { status: 'approved' });

            // Also add the user's UID to the 'members' array in the channel document itself
            const channelDocRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);
            await updateDoc(channelDocRef, {
                members: arrayUnion(memberUid)
            });

            setMessage(`Membre ${memberUid} approuvé.`);
        } catch (error) {
            console.error("Error approving member:", error);
            setMessage(`Erreur lors de l'approbation du membre: ${error.message}`);
        }
    };

    const handleRejectMember = async (memberUid) => {
        if (!db || !user || !channel) return;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        try {
            const memberDocRef = doc(db, `artifacts/${appId}/public/data/channels/${channelId}/members`, memberUid);
            await updateDoc(memberDocRef, { status: 'rejected' }); // Or delete the document

            // Remove the user's UID from the 'members' array in the channel document itself
            const channelDocRef = doc(db, `artifacts/${appId}/public/data/channels`, channelId);
            await updateDoc(channelDocRef, {
                members: arrayRemove(memberUid)
            });

            setMessage(`Membre ${memberUid} rejeté.`);
        } catch (error) {
            console.error("Error rejecting member:", error);
            setMessage(`Erreur lors du rejet du membre: ${error.message}`);
        }
    };

    if (loadingChat) {
        return <div className="text-center py-8">Chargement du canal...</div>;
    }

    if (!channel) {
        return <div className="text-center py-8">Canal non trouvé.</div>;
    }

    return (
        <div className="flex flex-col h-[70vh] bg-gray-50 dark:bg-gray-700 rounded-lg shadow-inner">
            <div className="flex items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 rounded-t-lg">
                <img src={channel.avatarUrl || getAvatarPlaceholder(channel.name)} alt="Avatar canal" className="w-12 h-12 rounded-full border-2 border-blue-500 mr-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{channel.name}</h3>
                {channel.isPrivate && <span className="ml-2 px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm">Privé</span>}
                <button
                    onClick={() => setCurrentPage('home')}
                    className="ml-auto px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors shadow-md"
                >
                    Retour à l'accueil
                </button>
            </div>

            {channel.adminId === user.uid && pendingMembers.length > 0 && (
                <div className="p-4 bg-yellow-100 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 border-b border-yellow-200 dark:border-yellow-700">
                    <h4 className="font-semibold mb-2">Demandes d'adhésion en attente :</h4>
                    <ul className="space-y-2">
                        {pendingMembers.map((member) => (
                            <li key={member.id} className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-700 p-2 rounded-md">
                                <span>{member.uid}</span> {/* In a real app, fetch displayName of this UID */}
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => handleApproveMember(member.id)}
                                        className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                    >
                                        Approuver
                                    </button>
                                    <button
                                        onClick={() => handleRejectMember(member.id)}
                                        className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                                    >
                                        Rejeter
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400">Aucun message dans ce canal. Soyez le premier à envoyer un message !</p>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex items-start space-x-3 ${msg.senderId === user.uid ? 'justify-end' : ''}`}
                        >
                            {msg.senderId !== user.uid && (
                                <img src={msg.senderAvatarUrl || getAvatarPlaceholder(msg.senderDisplayName)} alt="Avatar" className="w-8 h-8 rounded-full" />
                            )}
                            <div className={`p-3 rounded-lg shadow-sm ${msg.senderId === user.uid ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'}`}>
                                <div className="font-semibold text-sm mb-1">
                                    {msg.senderId === user.uid ? 'Vous' : msg.senderDisplayName}
                                </div>
                                <p>{msg.text}</p>
                                <div className="text-xs text-right mt-1 opacity-75">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            {msg.senderId === user.uid && (
                                <img src={msg.senderAvatarUrl || getAvatarPlaceholder(msg.senderDisplayName)} alt="Avatar" className="w-8 h-8 rounded-full" />
                            )}
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
                <div className="flex space-x-3">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Écrivez votre message..."
                        className="flex-grow px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
                    >
                        Envoyer
                    </button>
                </div>
            </form>
        </div>
    );
};

// User Profile Settings Page
const UserProfileSettings = () => {
    const { db, user, userProfile, setUserProfile, setCurrentPage, getAvatarPlaceholder, setMessage } = useAppContext();
    const [newDisplayName, setNewDisplayName] = useState(userProfile?.displayName || '');
    const [newAvatarUrl, setNewAvatarUrl] = useState(userProfile?.avatarUrl || '');
    const [loadingUpdate, setLoadingUpdate] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setNewDisplayName(userProfile.displayName || '');
            setNewAvatarUrl(userProfile.avatarUrl || '');
        }
    }, [userProfile]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoadingUpdate(true);
        setMessage('');

        if (!db || !user || !userProfile) {
            setMessage("Utilisateur non authentifié ou base de données non disponible.");
            setLoadingUpdate(false);
            return;
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const userProfileRef = doc(db, `artifacts/${appId}/users/${user.uid}/profiles`, user.uid);

        try {
            const updatedProfile = {
                ...userProfile,
                displayName: newDisplayName,
                avatarUrl: newAvatarUrl || getAvatarPlaceholder(userProfile.username), // Use placeholder if empty
            };
            await updateDoc(userProfileRef, updatedProfile);
            setUserProfile(updatedProfile);
            setMessage("Profil mis à jour avec succès !");
            setCurrentPage('home');
        } catch (error) {
            console.error("Error updating profile:", error);
            setMessage(`Erreur lors de la mise à jour du profil: ${error.message}`);
        } finally {
            setLoadingUpdate(false);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Modifier le Profil</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                    <label htmlFor="newDisplayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nouveau Pseudo d'affichage</label>
                    <input
                        type="text"
                        id="newDisplayName"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                </div>
                <div>
                    <label htmlFor="newAvatarUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL d'Avatar (Optionnel)</label>
                    <input
                        type="url"
                        id="newAvatarUrl"
                        value={newAvatarUrl}
                        onChange={(e) => setNewAvatarUrl(e.target.value)}
                        placeholder="Laissez vide pour l'avatar par défaut"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">URL d'image pour votre avatar. Si vide, un avatar par défaut sera utilisé.</p>
                </div>
                <div className="flex items-center space-x-4">
                    <img
                        src={newAvatarUrl || getAvatarPlaceholder(userProfile?.username || 'user')}
                        alt="Aperçu avatar"
                        className="w-16 h-16 rounded-full border-2 border-blue-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Aperçu de l'avatar</span>
                </div>
                <button
                    type="submit"
                    disabled={loadingUpdate}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                    {loadingUpdate ? "Mise à jour..." : "Mettre à jour le Profil"}
                </button>
                <button
                    type="button"
                    onClick={() => setCurrentPage('home')}
                    className="ml-4 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                    Annuler
                </button>
            </form>
        </div>
    );
};

export default App;
