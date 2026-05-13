import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Home, Compass, User, Heart, Clock, Play, Plus, 
  Check, Download, Share2, Settings, Moon, Sun, 
  Tv, Film, Star, TrendingUp, Bookmark, ChevronLeft, 
  ChevronRight, Search, Menu, X, LogOut, Mail, 
  MessageCircle, HelpCircle, Shield, FileText, 
  Volume2, VolumeX, Maximize, SkipBack, SkipForward,
  Play as PlayIcon, Pause, Loader2, Eye, Calendar,
  ThumbsUp, ThumbsDown, Flag, Bell, Award, Flame
} from 'lucide-react';

// Supabase Client
const supabaseUrl = 'https://cbevarkfzbpqcdwlhdxv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZXZhcmtmemJwcWNkd2xoZHh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTczOTYsImV4cCI6MjA5MjI5MzM5Nn0.syrYiiyTcLshafsBUhJX1jzZFVLoET8z11T80qeNpis';
const supabase = createClient(supabaseUrl, supabaseKey);

// Context API pour l'état global
const AppContext = createContext();

// Hooks personnalisés
const useAuth = () => useContext(AppContext).auth;
const useTheme = () => useContext(AppContext).theme;
const useUserData = () => useContext(AppContext).userData;

// Composants UI réutilisables
const Button = ({ children, variant = 'primary', size = 'md', icon, loading, onClick, className = '' }) => {
  const variants = {
    primary: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25',
    secondary: 'bg-gray-800/50 hover:bg-gray-700/50 text-gray-200 border border-gray-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'hover:bg-white/10 text-gray-300'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${variants[variant]} ${sizes[size]} rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
};

const Card = ({ anime, onClick, showProgress = false, progress = 0 }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const isNew = anime.created_at && new Date(anime.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return (
    <div 
      onClick={onClick}
      className="group relative flex-shrink-0 w-[160px] md:w-[180px] cursor-pointer transform transition-all duration-300 hover:scale-105 hover:z-10"
    >
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-indigo-900/50">
        <div className="aspect-[2/3] relative">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-800/30 to-indigo-800/30 animate-pulse" />
          )}
          <img
            src={anime.poster_url}
            alt={anime.title}
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center transform translate-y-2 group-hover:translate-y-0 transition-transform">
                  <PlayIcon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </div>
          {isNew && (
            <span className="absolute top-2 right-2 px-2 py-1 bg-gradient-to-r from-red-600 to-orange-600 text-white text-xs font-bold rounded-lg shadow-lg">
              NOUVEAU
            </span>
          )}
          {showProgress && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-purple-400 transition-colors">
            {anime.title}
          </h3>
          <p className="text-xs text-gray-400 mt-1 line-clamp-1">{anime.genre || 'Animation'}</p>
          <div className="flex items-center gap-2 mt-2">
            {anime.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="text-xs text-gray-300">{anime.rating}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">{anime.views?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SkeletonCard = () => (
  <div className="flex-shrink-0 w-[160px] md:w-[180px]">
    <div className="rounded-xl overflow-hidden bg-gray-800/50">
      <div className="aspect-[2/3] bg-gradient-to-br from-purple-900/20 to-indigo-900/20 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-700/50 rounded-lg animate-pulse" />
        <div className="h-3 bg-gray-700/50 rounded-lg w-2/3 animate-pulse" />
      </div>
    </div>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-800 animate-fade-in-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            {title}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  const icons = {
    success: <Check className="w-5 h-5 text-green-500" />,
    error: <X className="w-5 h-5 text-red-500" />,
    info: <MessageCircle className="w-5 h-5 text-blue-500" />
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-in-right">
      <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 shadow-xl">
        {icons[type]}
        <span className="text-gray-200">{message}</span>
      </div>
    </div>
  );
};

// Composant Lecteur Vidéo amélioré
const VideoPlayer = ({ src, title, onNext, onPrev, hasNext, hasPrev, onProgress }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef(null);
  
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  
  const handlePlayPause = () => {
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  const handleTimeUpdate = () => {
    const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(progress);
    setCurrentTime(videoRef.current.currentTime);
    onProgress?.(progress);
  };
  
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    videoRef.current.currentTime = percentage * videoRef.current.duration;
  };
  
  const handleFullscreen = () => {
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };
  
  return (
    <div className="relative bg-black rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onClick={handlePlayPause}
      />
      
      {/* Overlay des contrôles */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
        {/* Barre de progression */}
        <div 
          className="h-1 bg-gray-600 rounded-full mb-3 cursor-pointer"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-purple-500 rounded-full shadow-lg" />
          </div>
        </div>
        
        {/* Contrôles */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handlePlayPause} className="p-2 hover:bg-white/10 rounded-lg transition">
              {isPlaying ? <Pause className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-2 hover:bg-white/10 rounded-lg transition">
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <span className="text-sm text-gray-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {hasPrev && (
              <button onClick={onPrev} className="p-2 hover:bg-white/10 rounded-lg transition">
                <SkipBack className="w-5 h-5" />
              </button>
            )}
            {hasNext && (
              <button onClick={onNext} className="p-2 hover:bg-white/10 rounded-lg transition">
                <SkipForward className="w-5 h-5" />
              </button>
            )}
            <button onClick={handleFullscreen} className="p-2 hover:bg-white/10 rounded-lg transition">
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Titre flottant */}
      <div className="absolute top-4 left-4 right-4 opacity-0 hover:opacity-100 transition-opacity">
        <h3 className="text-white font-semibold text-lg drop-shadow-lg">{title}</h3>
      </div>
    </div>
  );
};

// Composant principal de l'application
const App = () => {
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  
  // Données
  const [animes, setAnimes] = useState([]);
  const [recentAnimes, setRecentAnimes] = useState([]);
  const [trendingAnimes, setTrendingAnimes] = useState([]);
  const [genres, setGenres] = useState([]);
  const [filter, setFilter] = useState('all');
  
  // Fonctions utilitaires
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };
  
  // Chargement initial
  useEffect(() => {
    loadInitialData();
    initAuth();
  }, []);
  
  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      await loadProfile(session.user.id);
    }
    setLoading(false);
    
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        await loadProfile(session.user.id);
        showToast('Connexion réussie !', 'success');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        showToast('Déconnecté', 'info');
      }
    });
  };
  
  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };
  
  const loadInitialData = async () => {
    const [recentRes, trendingRes, genresRes] = await Promise.all([
      supabase.from('animes').select('*').order('created_at', { ascending: false }).limit(12),
      supabase.from('animes').select('*').order('views', { ascending: false }).limit(12),
      supabase.from('animes').select('genre')
    ]);
    
    if (recentRes.data) setRecentAnimes(recentRes.data);
    if (trendingRes.data) setTrendingAnimes(trendingRes.data);
    if (genresRes.data) {
      const allGenres = [...new Set(genresRes.data.flatMap(a => (a.genre || '').split(',').map(g => g.trim()).filter(Boolean)))];
      setGenres(allGenres);
    }
    
    const { data: allAnimes } = await supabase.from('animes').select('*').order('created_at', { ascending: false });
    if (allAnimes) setAnimes(allAnimes);
  };
  
  const handleLogin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showToast(error.message, 'error');
      return false;
    }
    setAuthModalOpen(false);
    return true;
  };
  
  const handleRegister = async (email, password, username) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) {
      showToast(error.message, 'error');
      return false;
    }
    setAuthModalOpen(false);
    showToast('Compte créé avec succès !', 'success');
    return true;
  };
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentPage('home');
  };
  
  const toggleFavorite = async (animeId) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    
    const favorites = profile?.favorites || [];
    const newFavorites = favorites.includes(animeId)
      ? favorites.filter(id => id !== animeId)
      : [...favorites, animeId];
    
    await supabase.from('profiles').update({ favorites: newFavorites }).eq('id', user.id);
    setProfile({ ...profile, favorites: newFavorites });
    showToast(newFavorites.includes(animeId) ? 'Ajouté aux favoris' : 'Retiré des favoris');
  };
  
  const toggleWatchlist = async (animeId) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    
    const watchlist = profile?.watchlist || [];
    const newWatchlist = watchlist.includes(animeId)
      ? watchlist.filter(id => id !== animeId)
      : [...watchlist, animeId];
    
    await supabase.from('profiles').update({ watchlist: newWatchlist }).eq('id', user.id);
    setProfile({ ...profile, watchlist: newWatchlist });
    showToast(newWatchlist.includes(animeId) ? 'Ajouté à votre liste' : 'Retiré de votre liste');
  };
  
  const filteredAnimes = animes.filter(anime => {
    if (searchQuery && !anime.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filter === 'serie' && anime.type !== 'serie') return false;
    if (filter === 'film' && anime.type !== 'film') return false;
    return true;
  });
  
  const isFavorite = (animeId) => profile?.favorites?.includes(animeId);
  const isInWatchlist = (animeId) => profile?.watchlist?.includes(animeId);
  
  // Navigation
  const pages = {
    home: (
      <div className="space-y-8 animate-fade-in">
        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/20">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=2070')] bg-cover bg-center opacity-10" />
          <div className="relative p-8 md:p-12 text-center">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent mb-4">
              G-WORLD
            </h1>
            <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto">
              Regardez vos animes préférés en VF et VOSTFR gratuitement
            </p>
            <div className="flex flex-wrap gap-4 justify-center mt-8">
              <Button icon={<PlayIcon className="w-4 h-4" />} onClick={() => setCurrentPage('catalog')}>
                Commencer à regarder
              </Button>
              {!user && (
                <Button variant="secondary" icon={<User className="w-4 h-4" />} onClick={() => setAuthModalOpen(true)}>
                  Créer un compte
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Derniers ajouts */}
        <Section title="Derniers ajouts" icon={<Clock className="w-5 h-5" />}>
          <Carousel items={recentAnimes} onItemClick={(anime) => {
            setSelectedAnime(anime);
            setCurrentPage('detail');
          }} />
        </Section>
        
        {/* Tendances */}
        <Section title="Tendances" icon={<Flame className="w-5 h-5 text-orange-500" />}>
          <Carousel items={trendingAnimes} onItemClick={(anime) => {
            setSelectedAnime(anime);
            setCurrentPage('detail');
          }} />
        </Section>
        
        {/* Continuer visionnage (si connecté) */}
        {profile?.history?.length > 0 && (
          <Section title="Continuer votre visionnage" icon={<PlayIcon className="w-5 h-5" />}>
            <Carousel 
              items={animes.filter(a => profile.history.includes(a.id))} 
              onItemClick={(anime) => {
                setSelectedAnime(anime);
                setCurrentPage('detail');
              }}
            />
          </Section>
        )}
      </div>
    ),
    
    catalog: (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold">Catalogue</h1>
          </div>
          
          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Tous</FilterButton>
            <FilterButton active={filter === 'serie'} onClick={() => setFilter('serie')}>Séries</FilterButton>
            <FilterButton active={filter === 'film'} onClick={() => setFilter('film')}>Films</FilterButton>
          </div>
        </div>
        
        {/* Résultats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredAnimes.map(anime => (
            <Card
              key={anime.id}
              anime={anime}
              onClick={() => {
                setSelectedAnime(anime);
                setCurrentPage('detail');
              }}
            />
          ))}
        </div>
        
        {filteredAnimes.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Aucun anime trouvé</p>
          </div>
        )}
      </div>
    ),
    
    detail: selectedAnime && (
      <AnimeDetail
        anime={selectedAnime}
        user={user}
        profile={profile}
        isFavorite={isFavorite(selectedAnime.id)}
        isInWatchlist={isInWatchlist(selectedAnime.id)}
        onToggleFavorite={toggleFavorite}
        onToggleWatchlist={toggleWatchlist}
        onBack={() => setCurrentPage('catalog')}
      />
    ),
    
    profile: user ? (
      <UserProfile
        profile={profile}
        animes={animes}
        onLogout={handleLogout}
        onAnimeClick={(anime) => {
          setSelectedAnime(anime);
          setCurrentPage('detail');
        }}
      />
    ) : (
      <div className="text-center py-12">
        <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 mb-4">Connectez-vous pour voir votre profil</p>
        <Button onClick={() => setAuthModalOpen(true)}>Se connecter</Button>
      </div>
    ),
    
    help: <HelpPage />,
    contact: <ContactPage />,
    terms: <LegalPage title="Conditions d'utilisation" type="terms" />,
    privacy: <LegalPage title="Politique de confidentialité" type="privacy" />,
    dmca: <LegalPage title="DMCA" type="dmca" />
  };
  
  return (
    <AppContext.Provider value={{ auth: { user, profile }, theme, userData: { profile } }}>
      <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
        <div className="bg-gradient-to-br from-gray-900 via-purple-900/20 to-indigo-900/20 min-h-screen">
          {/* Header */}
          <Header
            user={user}
            profile={profile}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onLoginClick={() => setAuthModalOpen(true)}
            onLogout={handleLogout}
            onPageChange={setCurrentPage}
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          
          {/* Sidebar */}
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            genres={genres}
            user={user}
            onLoginClick={() => setAuthModalOpen(true)}
          />
          
          {/* Main Content */}
          <main className={`transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
            <div className="container mx-auto px-4 py-8">
              {pages[currentPage]}
            </div>
          </main>
          
          {/* Footer */}
          <Footer onPageChange={setCurrentPage} />
        </div>
      </div>
      
      {/* Modals */}
      <Modal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} title={authMode === 'login' ? 'Connexion' : 'Inscription'}>
        <AuthForm
          mode={authMode}
          onToggleMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      </Modal>
      
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AppContext.Provider>
  );
};

// Composants supplémentaires
const Section = ({ title, icon, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 border-l-4 border-purple-500 pl-3">
      {icon}
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
    {children}
  </div>
);

const Carousel = ({ items, onItemClick }) => {
  const scrollRef = useRef(null);
  
  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  
  return (
    <div className="relative group">
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map(item => (
          <Card key={item.id} anime={item} onClick={() => onItemClick(item)} />
        ))}
      </div>
      
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};

const FilterButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
      active
        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
        : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
    }`}
  >
    {children}
  </button>
);

const Header = ({ user, profile, searchQuery, onSearchChange, onLoginClick, onLogout, onPageChange, sidebarOpen, onSidebarToggle }) => (
  <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
    <div className="container mx-auto px-4">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center gap-4">
          <button onClick={onSidebarToggle} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onPageChange('home')}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
              <PlayIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              G-WORLD
            </span>
          </div>
        </div>
        
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un anime..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onPageChange('profile')}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-xl hover:bg-gray-700/50 transition"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold">
                  {(profile?.username || 'U')[0].toUpperCase()}
                </div>
                <span className="hidden md:inline text-sm">{profile?.username}</span>
              </button>
              <button onClick={onLogout} className="p-2 hover:bg-gray-800 rounded-lg transition">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button size="sm" onClick={onLoginClick}>
              Connexion
            </Button>
          )}
        </div>
      </div>
    </div>
  </header>
);

const Sidebar = ({ isOpen, onClose, currentPage, onPageChange, genres, user, onLoginClick }) => {
  const navItems = [
    { id: 'home', label: 'Accueil', icon: Home },
    { id: 'catalog', label: 'Catalogue', icon: Compass },
    { id: 'help', label: 'Aide & FAQ', icon: HelpCircle },
    { id: 'contact', label: 'Contact', icon: Mail },
  ];
  
  const legalItems = [
    { id: 'terms', label: 'Conditions', icon: FileText },
    { id: 'privacy', label: 'Confidentialité', icon: Shield },
    { id: 'dmca', label: 'DMCA', icon: Flag },
  ];
  
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onClose} />
      )}
      
      <aside className={`fixed top-16 left-0 bottom-0 w-64 bg-gray-900/95 backdrop-blur-xl border-r border-gray-800 z-30 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex flex-col h-full overflow-y-auto">
          <nav className="flex-1 p-4 space-y-6">
            {/* Navigation principale */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Menu</h3>
              <div className="space-y-1">
                {navItems.map(item => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={currentPage === item.id}
                    onClick={() => {
                      onPageChange(item.id);
                      onClose();
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* Genres */}
            {genres.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {genres.slice(0, 10).map(genre => (
                    <button
                      key={genre}
                      onClick={() => {
                        onPageChange('catalog');
                        onClose();
                      }}
                      className="px-2 py-1 text-xs bg-gray-800 rounded-lg hover:bg-gray-700 transition"
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Légal */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Légal</h3>
              <div className="space-y-1">
                {legalItems.map(item => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={currentPage === item.id}
                    onClick={() => {
                      onPageChange(item.id);
                      onClose();
                    }}
                  />
                ))}
              </div>
            </div>
          </nav>
          
          {/* Footer sidebar */}
          <div className="p-4 border-t border-gray-800">
            {!user && (
              <Button size="sm" className="w-full" onClick={() => {
                onLoginClick();
                onClose();
              }}>
                Se connecter
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
      active
        ? 'bg-gradient-to-r from-purple-600/20 to-indigo-600/20 text-purple-400 border-l-2 border-purple-500'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
    }`}
  >
    <Icon className="w-4 h-4" />
    <span className="text-sm font-medium">{label}</span>
  </button>
);

const AnimeDetail = ({ anime, user, profile, isFavorite, isInWatchlist, onToggleFavorite, onToggleWatchlist, onBack }) => {
  const [selectedLang, setSelectedLang] = useState('vostfr');
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadSeasonsAndEpisodes();
  }, [anime.id]);
  
  const loadSeasonsAndEpisodes = async () => {
    setLoading(true);
    const { data: seasonsData } = await supabase.from('seasons').select('*').eq('anime_id', anime.id).order('season_number');
    setSeasons(seasonsData || []);
    
    if (seasonsData?.length) {
      const seasonIds = seasonsData.map(s => s.id);
      const { data: episodesData } = await supabase.from('episodes').select('*').in('season_id', seasonIds).order('episode_number');
      setEpisodes(episodesData || []);
      
      // Premier épisode par défaut
      if (episodesData?.length) {
        setSelectedEpisode(episodesData[0]);
      }
    }
    setLoading(false);
  };
  
  const getStreamUrl = () => {
    if (!selectedEpisode) return null;
    return selectedLang === 'vf' ? selectedEpisode.vf_stream : selectedEpisode.vostfr_stream;
  };
  
  const hasVostfr = episodes.some(e => e.vostfr_stream) || anime.vostfr_stream;
  const hasVf = episodes.some(e => e.vf_stream) || anime.vf_stream;
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
        <ChevronLeft className="w-5 h-5" />
        Retour au catalogue
      </button>
      
      {/* Info principale */}
      <div className="grid md:grid-cols-[250px,1fr] gap-6">
        {/* Poster */}
        <div className="rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/50 to-indigo-900/50">
          <img src={anime.poster_url} alt={anime.title} className="w-full" />
        </div>
        
        {/* Infos */}
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            {anime.title}
          </h1>
          
          <div className="flex flex-wrap gap-2">
            {anime.genre?.split(',').map(g => (
              <span key={g} className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded-lg">
                {g.trim()}
              </span>
            ))}
            {anime.rating && (
              <span className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600/20 text-yellow-400 rounded-lg">
                <Star className="w-3 h-3 fill-yellow-400" />
                {anime.rating}/10
              </span>
            )}
            <span className="px-2 py-1 text-xs bg-gray-800 rounded-lg">{anime.type === 'serie' ? 'Série' : 'Film'}</span>
          </div>
          
          <p className="text-gray-300 leading-relaxed">{anime.description || 'Aucune description disponible.'}</p>
          
          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant={isFavorite ? 'primary' : 'secondary'}
              icon={isFavorite ? <Check className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
              onClick={() => onToggleFavorite(anime.id)}
            >
              {isFavorite ? 'Favori' : 'Ajouter aux favoris'}
            </Button>
            <Button
              variant={isInWatchlist ? 'primary' : 'secondary'}
              icon={isInWatchlist ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              onClick={() => onToggleWatchlist(anime.id)}
            >
              {isInWatchlist ? 'Dans ma liste' : 'À regarder'}
            </Button>
            <Button variant="secondary" icon={<Share2 className="w-4 h-4" />}>
              Partager
            </Button>
          </div>
        </div>
      </div>
      
      {/* Langue */}
      {(hasVostfr || hasVf) && (
        <div className="flex gap-3">
          {hasVostfr && (
            <button
              onClick={() => setSelectedLang('vostfr')}
              className={`px-4 py-2 rounded-xl font-medium transition ${
                selectedLang === 'vostfr'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🇯🇵 VOSTFR
            </button>
          )}
          {hasVf && (
            <button
              onClick={() => setSelectedLang('vf')}
              className={`px-4 py-2 rounded-xl font-medium transition ${
                selectedLang === 'vf'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🇫🇷 VF
            </button>
          )}
        </div>
      )}
      
      {/* Lecteur vidéo */}
      {anime.type === 'film' ? (
        <VideoPlayer
          src={selectedLang === 'vf' ? anime.vf_stream : anime.vostfr_stream}
          title={anime.title}
        />
      ) : (
        <>
          {!loading && selectedEpisode && (
            <VideoPlayer
              src={getStreamUrl()}
              title={`${anime.title} - Épisode ${selectedEpisode.episode_number}`}
            />
          )}
          
          {/* Épisodes par saison */}
          {seasons.map(season => {
            const seasonEpisodes = episodes.filter(e => e.season_id === season.id);
            return (
              <div key={season.id} className="space-y-3">
                <h3 className="text-lg font-semibold">{season.name}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {seasonEpisodes.map(ep => (
                    <button
                      key={ep.id}
                      onClick={() => setSelectedEpisode(ep)}
                      className={`px-3 py-2 rounded-lg text-center text-sm font-medium transition ${
                        selectedEpisode?.id === ep.id
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      Ép. {ep.episode_number}
                      {ep.title && <span className="block text-xs opacity-75">{ep.title}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

const UserProfile = ({ profile, animes, onLogout, onAnimeClick }) => {
  const [activeTab, setActiveTab] = useState('favorites');
  
  const favoritesAnimes = animes.filter(a => profile?.favorites?.includes(a.id));
  const watchlistAnimes = animes.filter(a => profile?.watchlist?.includes(a.id));
  const historyAnimes = animes.filter(a => profile?.history?.includes(a.id));
  
  const tabs = [
    { id: 'favorites', label: 'Favoris', count: favoritesAnimes.length, icon: Heart },
    { id: 'watchlist', label: 'À regarder', count: watchlistAnimes.length, icon: Bookmark },
    { id: 'history', label: 'Historique', count: historyAnimes.length, icon: Clock },
  ];
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profil header */}
      <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-2xl p-6 border border-purple-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center text-2xl font-bold">
              {(profile?.username || 'U')[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile?.username}</h1>
              <p className="text-gray-400">{profile?.email}</p>
            </div>
          </div>
          <Button variant="danger" icon={<LogOut className="w-4 h-4" />} onClick={onLogout}>
            Déconnexion
          </Button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-800">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{profile?.favorites?.length || 0}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Favoris</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{profile?.watchlist?.length || 0}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">À regarder</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{profile?.history?.length || 0}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Vus</div>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>
      
      {/* Contenu */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {activeTab === 'favorites' && favoritesAnimes.map(anime => (
          <Card key={anime.id} anime={anime} onClick={() => onAnimeClick(anime)} />
        ))}
        {activeTab === 'watchlist' && watchlistAnimes.map(anime => (
          <Card key={anime.id} anime={anime} onClick={() => onAnimeClick(anime)} />
        ))}
        {activeTab === 'history' && historyAnimes.map(anime => (
          <Card key={anime.id} anime={anime} onClick={() => onAnimeClick(anime)} />
        ))}
      </div>
      
      {activeTab === 'favorites' && favoritesAnimes.length === 0 && (
        <EmptyState icon={Heart} message="Aucun favori pour le moment" />
      )}
      {activeTab === 'watchlist' && watchlistAnimes.length === 0 && (
        <EmptyState icon={Bookmark} message="Aucun anime dans votre liste" />
      )}
      {activeTab === 'history' && historyAnimes.length === 0 && (
        <EmptyState icon={Clock} message="Aucun historique de visionnage" />
      )}
    </div>
  );
};

const EmptyState = ({ icon: Icon, message }) => (
  <div className="text-center py-12">
    <Icon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
    <p className="text-gray-400">{message}</p>
  </div>
);

const HelpPage = () => (
  <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
      Aide & FAQ
    </h1>
    
    <div className="space-y-4">
      {faqData.map((item, index) => (
        <div key={index} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="font-semibold text-lg text-purple-400 mb-2">{item.question}</h3>
          <p className="text-gray-300">{item.answer}</p>
        </div>
      ))}
    </div>
  </div>
);

const ContactPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    
    const { error } = await supabase.from('contacts').insert(formData);
    if (!error) {
      alert('Message envoyé avec succès !');
      setFormData({ name: '', email: '', subject: '', message: '' });
    }
    setSending(false);
  };
  
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
        Nous contacter
      </h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nom complet</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Sujet</label>
          <select
            required
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
          >
            <option value="">Sélectionner un sujet</option>
            <option>Problème technique</option>
            <option>Signalement de contenu</option>
            <option>Suggestion</option>
            <option>Autre</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            required
            rows={5}
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>
        
        <Button type="submit" loading={sending} className="w-full">
          Envoyer le message
        </Button>
      </form>
    </div>
  );
};

const LegalPage = ({ title, type }) => {
  const content = legalContents[type];
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
        {title}
      </h1>
      <div className="prose prose-invert max-w-none">
        {content?.map((section, index) => (
          <div key={index} className="mb-6">
            <h2 className="text-xl font-semibold text-purple-400 mb-2">{section.title}</h2>
            <p className="text-gray-300">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const AuthForm = ({ mode, onToggleMode, onLogin, onRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let success;
    if (mode === 'login') {
      success = await onLogin(email, password);
    } else {
      success = await onRegister(email, password, username);
    }
    
    setLoading(false);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === 'register' && (
        <div>
          <label className="block text-sm font-medium mb-1">Pseudo</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Mot de passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:border-purple-500"
        />
      </div>
      
      <Button type="submit" loading={loading} className="w-full">
        {mode === 'login' ? 'Se connecter' : 'S\'inscrire'}
      </Button>
      
      <p className="text-center text-sm text-gray-400">
        {mode === 'login' ? 'Pas de compte ?' : 'Déjà un compte ?'}
        <button type="button" onClick={onToggleMode} className="ml-1 text-purple-400 hover:underline">
          {mode === 'login' ? 'S\'inscrire' : 'Se connecter'}
        </button>
      </p>
    </form>
  );
};

const Footer = ({ onPageChange }) => (
  <footer className="border-t border-gray-800 mt-12">
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div>
          <h4 className="font-semibold text-purple-400 mb-3">Navigation</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><button onClick={() => onPageChange('home')} className="hover:text-white transition">Accueil</button></li>
            <li><button onClick={() => onPageChange('catalog')} className="hover:text-white transition">Catalogue</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-purple-400 mb-3">Support</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><button onClick={() => onPageChange('help')} className="hover:text-white transition">Aide & FAQ</button></li>
            <li><button onClick={() => onPageChange('contact')} className="hover:text-white transition">Contact</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-purple-400 mb-3">Légal</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li><button onClick={() => onPageChange('terms')} className="hover:text-white transition">Conditions</button></li>
            <li><button onClick={() => onPageChange('privacy')} className="hover:text-white transition">Confidentialité</button></li>
            <li><button onClick={() => onPageChange('dmca')} className="hover:text-white transition">DMCA</button></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-purple-400 mb-3">À propos</h4>
          <p className="text-sm text-gray-400">
            G-WORLD - Anime streaming gratuit en VF et VOSTFR
          </p>
        </div>
      </div>
      <div className="text-center text-sm text-gray-500 pt-8 mt-8 border-t border-gray-800">
        © 2026 G-WORLD. Tous droits réservés.
      </div>
    </div>
  </footer>
);

// Données statiques
const faqData = [
  { question: "Comment regarder un anime ?", answer: "Connectez-vous, recherchez l'anime souhaité, cliquez dessus et choisissez VF ou VOSTFR." },
  { question: "C'est vraiment gratuit ?", answer: "Oui, G-WORLD est entièrement gratuit sans abonnement." },
  { question: "Que faire si le lecteur ne fonctionne pas ?", answer: "Rafraîchissez la page ou contactez-nous via le formulaire." },
  { question: "Puis-je télécharger les épisodes ?", answer: "Oui, utilisez le bouton Télécharger sous le lecteur." },
];

const legalContents = {
  terms: [
    { title: "Acceptation des conditions", content: "En utilisant G-WORLD, vous acceptez ces conditions d'utilisation." },
    { title: "Utilisation du service", content: "Le service est réservé à un usage personnel et non commercial." },
    { title: "Compte utilisateur", content: "Vous êtes responsable de la confidentialité de vos identifiants." },
  ],
  privacy: [
    { title: "Données collectées", content: "Nous collectons votre email et pseudo pour gérer votre compte." },
    { title: "Sécurité", content: "Vos mots de passe sont chiffrés et stockés de manière sécurisée." },
    { title: "Vos droits", content: "Vous pouvez demander la suppression de vos données à tout moment." },
  ],
  dmca: [
    { title: "Politique DMCA", content: "G-WORLD respecte les droits d'auteur. Signalez tout contenu illégal." },
    { title: "Signalement", content: "Contactez-nous avec les détails du contenu concerné." },
  ],
};

export default App;