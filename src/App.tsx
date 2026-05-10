import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Upload, Trash2, LogIn, LogOut, Loader2, Youtube, Book, Smartphone, Globe, Instagram, X, Check } from 'lucide-react';
import { 
  ref as storageRef, 
  uploadBytesResumable, 
  getDownloadURL 
} from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  getDocFromServer,
  collection,
  query,
  orderBy
} from 'firebase/firestore';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function Spotlight() {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return <div className="spotlight" />;
}

function Divider() {
  return (
    <div className="flex justify-center items-center py-16 opacity-40">
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#d4c5b0] to-transparent"></div>
      <div className="mx-4 text-xl">✧</div>
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#d4c5b0] to-transparent"></div>
    </div>
  );
}

function MediaPlayer({ url, onSaveUrl, isUploading, isOwner }: { url: string, onSaveUrl: (url: string) => void, isUploading?: boolean, isOwner?: boolean }) {
  const [inputUrl, setInputUrl] = useState('');

  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : null;
  };

  const processUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    if (rawUrl.includes('dropbox.com')) {
      let url = rawUrl.replace(/dl=[01]/, 'raw=1');
      if (!url.includes('raw=1')) {
        url += url.includes('?') ? '&raw=1' : '?raw=1';
      }
      return url;
    }
    return rawUrl;
  };

  const processedUrl = processUrl(url);
  const videoId = getYouTubeId(processedUrl);
  const isDirectVideo = processedUrl && !videoId;

  return (
    <div className="bg-[#1a1a1a] border border-[#332b20] p-6 rounded-sm max-w-2xl mx-auto shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 pointer-events-none"></div>
      <div className="relative z-10 flex flex-col items-center">
        <h3 className="font-serif text-xl mb-6 tracking-widest text-[#d4c5b0]">THE SPARK</h3>
        
        {!processedUrl ? (
          <div className="w-full border border-[#FFBF00]/30 border-dashed flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-sm relative">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-6 h-6 mb-2 animate-spin text-[#FFBF00]" />
                <span className="font-serif tracking-widest text-xs uppercase text-center mt-2 text-[#FFBF00]">Saving...</span>
              </div>
            ) : (
              <>
                <Play className="w-8 h-8 mb-2 text-[#FFBF00]/70" />
                <span className="font-serif tracking-widest text-xs uppercase text-center mt-2 text-[#FFBF00]/70 mb-4">
                  Paste Video URL
                </span>
                <input 
                  type="text" 
                  placeholder="YouTube or direct video link..." 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-black/50 border border-[#FFBF00]/30 text-[#d4c5b0] px-3 py-2 text-xs font-mono mb-4 outline-none focus:border-[#FFBF00]/80 transition-colors"
                />
                <button 
                  onClick={() => onSaveUrl(inputUrl)}
                  disabled={!inputUrl}
                  className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-4 py-1 text-xs font-serif uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  Save URL
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="w-full aspect-video bg-black flex items-center justify-center border border-[#FFBF00]/20 relative z-50 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              {videoId ? (
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0`} 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              ) : (
                <video 
                  controls 
                  src={processedUrl} 
                  className="w-full h-full object-contain"
                  controlsList="nodownload"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
            {isOwner && (
              <div className="mt-4 flex gap-2 w-full relative z-20">
                <input 
                  type="text" 
                  placeholder="Update video URL..." 
                  value={inputUrl || url}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="flex-1 bg-black/80 border border-[#FFBF00]/30 text-[#d4c5b0] px-2 py-1 text-xs font-mono outline-none focus:border-[#FFBF00]/80"
                />
                <button 
                  onClick={() => onSaveUrl(inputUrl || url)}
                  className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-3 py-1 text-xs font-serif uppercase tracking-widest"
                >
                  {isUploading ? '...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [assets, setAssets] = useState({
    monad: '/monad.png',
    cover: '/cover2.jpg',
    spread: '/Spread2.jpeg',
    narration: ''
  });
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isShowingOrders, setIsShowingOrders] = useState(false);
  const [isShowingBookManager, setIsShowingBookManager] = useState(false);
  const [isFulfillmentLoading, setIsFulfillmentLoading] = useState(true);
  const [bookLinks, setBookLinks] = useState({
    hardcoverLuluUrl: 'https://www.lulu.com/shop/frederick-sean-beesley/the-awakening-of-the-spark/hardcover/product-m2gzy2r.html?page=1&pageSize=4',
    softcoverLuluUrl: 'https://www.lulu.com/shop/frederick-sean-beesley/the-awakening-of-the-spark/paperback/product-yvry5ny.html?page=1&pageSize=4',
    ebook: '',
    ebookCover: ''
  });
  const [inputBookLinks, setInputBookLinks] = useState({
    hardcoverLuluUrl: '',
    softcoverLuluUrl: ''
  });
  const [uploadStats, setUploadStats] = useState<{[key: string]: number}>({});
  const [inputUrls, setInputUrls] = useState({ 
    monad: '', 
    cover: '', 
    spread: '',
    narration: ''
  });

  const isOwner = user?.email?.toLowerCase() === "dieblind@gmail.com";

  // Validate Connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Load assets and book links from Firestore
  useEffect(() => {
    if (!isAuthReady) return;

    // Load main UI assets
    const assetPath = 'site_config/main_assets';
    const unsubAssets = onSnapshot(doc(db, assetPath), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      // Merge cloud config with local defaults
      setAssets({
        monad: data.monadUrl || '/monad.png',
        cover: data.coverUrl || '/cover2.jpg',
        spread: data.spreadUrl || '/Spread2.jpeg',
        narration: data.narrationUrl || ''
      });
    }, (err) => {
      console.warn("Public asset load failed, using defaults:", err.message);
      // Defaults already set in state, but ensuring they stay if load fails
    });

    return () => {
      unsubAssets();
    };
  }, [isAuthReady]);

  // Protected Admin Listeners
  useEffect(() => {
    if (!isAuthReady || !user || !isOwner) return;

    // Load book fulfillment links (Admin only)
    const bookPath = 'site_config/book_fulfillment';
    setIsFulfillmentLoading(true);
    const unsubBooks = onSnapshot(doc(db, bookPath), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setBookLinks({
          hardcoverLuluUrl: data.hardcoverLuluUrl || 'https://www.lulu.com/shop/frederick-sean-beesley/the-awakening-of-the-spark/hardcover/product-m2gzy2r.html?page=1&pageSize=4',
          softcoverLuluUrl: data.softcoverLuluUrl || 'https://www.lulu.com/shop/frederick-sean-beesley/the-awakening-of-the-spark/paperback/product-yvry5ny.html?page=1&pageSize=4',
          ebook: data.ebook || '',
          ebookCover: data.ebookCover || ''
        });
      }
      setIsFulfillmentLoading(false);
    }, (err) => {
      console.error("Fulfillment load failed:", err);
      setIsFulfillmentLoading(false);
    });

    // Load recent orders (Admin only)
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const unsubOrders = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentOrders(orders);
    }, (err) => {
      console.error("Orders list failed:", err);
    });

    return () => {
      unsubBooks();
      unsubOrders();
    };
  }, [isAuthReady, user, isOwner]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Login failed", err);
      alert("Login failed: " + err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleUrlSave = async (key: 'monad' | 'cover' | 'spread' | 'narration', url: string) => {
    if (!url || !user) return;

    // Only allow the owner to upload (Case-insensitive check)
    if (user.email?.toLowerCase() !== "dieblind@gmail.com") {
      alert(`Access Denied: Logged in as ${user.email}. Only DieBlind@gmail.com can manage assets.`);
      return;
    }

    setUploadingKey(key);

    try {
      console.log(`Saving URL for ${key}...`);
      
      const path = 'site_config/main_assets';
      await setDoc(doc(db, path), {
        [`${key}Url`]: url,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log(`Firestore updated successfully for ${key}`);
      setInputUrls(prev => ({ ...prev, [key]: '' })); // Clear input
    } catch (err) {
      console.error(`Error saving ${key} URL:`, err);
      handleFirestoreError(err, OperationType.WRITE, 'site_config/main_assets');
    } finally {
      setUploadingKey(null);
    }
  };

  const clearAssets = async () => {
    if (!user || user.email?.toLowerCase() !== "dieblind@gmail.com") return;
    
    if (!confirm("Are you sure you want to clear all cloud assets?")) return;

    const path = 'site_config/main_assets';
    try {
      await setDoc(doc(db, path), {
        monadUrl: '',
        coverUrl: '',
        spreadUrl: '',
        narrationUrl: '',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleFileUpload = async (key: string, file: File) => {
    if (!isOwner) return;
    
    const fileRef = storageRef(storage, `fulfillment/${key}_${Date.now()}.pdf`);
    const uploadTask = uploadBytesResumable(fileRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadStats(prev => ({ ...prev, [key]: progress }));
      }, 
      (error) => {
        console.error("Upload failed", error);
        alert(`Upload failed: ${error.message}`);
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Save to Firestore so the server can see it
        try {
          await setDoc(doc(db, 'site_config/book_fulfillment'), {
            [key]: downloadURL,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'site_config/book_fulfillment');
        }
        
        setUploadStats(prev => {
          const next = {...prev};
          delete next[key];
          return next;
        });
      }
    );
  };

  const handleBookLinkSave = async (key: string, url: string) => {
    if (!isOwner) return;
    try {
      await setDoc(doc(db, 'site_config/book_fulfillment'), {
        [key]: url,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert("Link saved to cloud!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'site_config/book_fulfillment');
    }
  };

  const [showAdminUI, setShowAdminUI] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('admin') === 'true') {
        setShowAdminUI(true);
      }
      if (params.get('success') === 'true') {
        const item = params.get('item');
        setTimeout(() => alert(`Order successful for ${item}! (Test Mode)`), 500);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (params.get('canceled') === 'true') {
        setTimeout(() => alert(`Checkout canceled.`), 500);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const verifyOrderStatus = async (jobId: string, orderId: string) => {
    try {
      const res = await fetch(`/api/lulu-status/${jobId}`);
      const data = await res.json();
      
      // Update local state is handled by onSnapshot
      // But we must update Firestore to make it permanent
      await updateDoc(doc(db, "orders", orderId), {
        verifiedStatus: data.status,
        luluVerifiedAt: serverTimestamp()
      });
    } catch (e) {
      alert("Failed to verify status with Lulu API.");
    }
  };

  return (
    <div className="min-h-screen relative selection:bg-[#FFBF00]/30 selection:text-[#FFBF00]">
      <div className="texture-overlay"></div>
      <div className="chemical-spill"></div>
      <div className="scratches-overlay"></div>
      <div className="vignette"></div>
      <Spotlight />

      {/* Admin Controls - Moved to end of body for max visibility */}
      {showAdminUI && (
      <div 
        className="fixed top-6 right-6 z-[9999999] pointer-events-auto flex flex-col items-end gap-3"
      >
        {!isAuthReady ? (
          <div className="bg-black/95 border-2 border-[#FFBF00]/30 p-3 shadow-2xl backdrop-blur-xl">
            <Loader2 className="w-5 h-5 animate-spin text-[#FFBF00]" />
          </div>
        ) : !user ? (
          <button 
            id="admin-login-button"
            onClick={handleLogin}
            className="bg-black border-2 border-[#FFBF00] text-[#FFBF00] px-6 py-3 rounded-none shadow-[0_0_30px_rgba(255,191,0,0.4)] hover:bg-[#FFBF00] hover:text-black transition-all flex items-center gap-2 text-sm font-mono font-bold cursor-pointer"
          >
            <LogIn className="w-5 h-5" /> ADMIN LOGIN
          </button>
        ) : (
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              {isOwner && (
                <>
                  <button 
                    onClick={() => setIsShowingBookManager(!isShowingBookManager)}
                    className={`bg-black/95 border-2 ${Object.values(bookLinks).every(v => v) ? "border-green-500 text-green-400" : "border-blue-500 text-blue-400"} px-4 py-2 rounded-sm backdrop-blur-xl transition-all flex items-center gap-2 text-xs font-mono shadow-2xl hover:scale-105`}
                  >
                    <Book className="w-4 h-4" /> FULFILLMENT
                  </button>
                  <button 
                    onClick={() => setIsShowingOrders(!isShowingOrders)}
                    className={`bg-black/95 border-2 ${recentOrders.length > 0 ? "border-green-500 text-green-400" : "border-[#FFBF00] text-[#FFBF00]"} px-4 py-2 rounded-sm backdrop-blur-xl transition-all flex items-center gap-2 text-xs font-mono shadow-2xl hover:scale-105`}
                  >
                    <Smartphone className="w-4 h-4" /> LIVE ORDERS ({recentOrders.length})
                  </button>
                </>
              )}
              <button 
                id="admin-logout-button"
                onClick={handleLogout}
                className="bg-black/95 border-2 border-red-500 text-red-500 px-4 py-2 rounded-sm backdrop-blur-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-xs font-mono shadow-2xl"
              >
                <LogOut className="w-4 h-4" /> LOGOUT
              </button>
            </div>
            {isOwner && (
              <span className="text-[10px] font-mono text-[#FFBF00] bg-black/80 px-2 py-1 rounded-sm border border-[#FFBF00]/30 shadow-lg capitalize">
                Admin Active: {user.email?.split('@')[0]}
              </span>
            )}
          </div>
        )}

        {/* Dropdowns for Admin - Integrated into the fixed container */}
        {isOwner && isShowingBookManager && (
          <div className="w-80 bg-black/95 border border-blue-500/50 p-4 shadow-2xl backdrop-blur-xl mt-2 animate-in fade-in slide-in-from-top-2">
            <h4 className="font-mono text-blue-400 text-xs mb-1 uppercase flex items-center gap-2">
              <Upload className="w-3 h-3" /> Fulfillment PDFs
            </h4>
            <p className="text-[10px] text-blue-400/50 font-mono mb-4 italic">Files save automatically to cloud on upload</p>
            <div className="flex flex-col gap-4">
              {isFulfillmentLoading ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                  <span className="text-[10px] text-blue-400 font-mono italic">Syncing with cloud...</span>
                </div>
              ) : [
                { id: 'hardcoverLuluUrl', label: 'Hardcover Lulu URL', type: 'url' },
                { id: 'softcoverLuluUrl', label: 'Softcover Lulu URL', type: 'url' },
                { id: 'ebook', label: 'Digital Ebook (PDF)', type: 'file' },
                { id: 'ebookCover', label: 'Digital Ebook Cover (IMG/PDF)', type: 'file' },
              ].map(f => (
                <div key={f.id} className="flex flex-col gap-1 border-b border-blue-500/10 pb-2 last:border-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] text-gray-400 uppercase font-mono">{f.label}</span>
                    {bookLinks[f.id as keyof typeof bookLinks] ? (
                      <span className="text-[9px] text-green-500 font-mono flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Saved to Cloud
                      </span>
                    ) : (
                      <span className="text-[9px] text-red-500/70 font-mono">Unset</span>
                    )}
                  </div>
                  <div className="relative">
                    {f.type === 'file' ? (
                      <>
                        <input 
                          type="file" 
                          title={`Upload ${f.label}`}
                          accept={f.id.toLowerCase().includes('cover') ? ".jpg,.jpeg,.png,.pdf" : ".pdf"}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(f.id, file);
                          }}
                          className="text-[10px] text-gray-400 bg-white/5 w-full border border-blue-500/20 p-1 file:hidden cursor-pointer hover:border-blue-500/50 transition-colors"
                        />
                        {uploadStats[f.id] !== undefined && (
                          <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                            <div className="text-[10px] text-white font-mono font-bold">{Math.round(uploadStats[f.id])}%</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="https://www.lulu.com/..."
                          value={inputBookLinks[f.id as keyof typeof inputBookLinks] !== undefined && inputBookLinks[f.id as keyof typeof inputBookLinks] !== '' ? inputBookLinks[f.id as keyof typeof inputBookLinks] : bookLinks[f.id as keyof typeof bookLinks] || ''}
                          onChange={(e) => setInputBookLinks(prev => ({...prev, [f.id]: e.target.value}))}
                          className="flex-1 bg-black/80 border border-blue-500/30 text-blue-100 px-2 py-1 text-[10px] font-mono outline-none focus:border-blue-500/80"
                        />
                        <button 
                          onClick={() => {
                            const urlToSave = inputBookLinks[f.id as keyof typeof inputBookLinks] !== undefined && inputBookLinks[f.id as keyof typeof inputBookLinks] !== '' ? inputBookLinks[f.id as keyof typeof inputBookLinks] : bookLinks[f.id as keyof typeof bookLinks];
                            if (typeof urlToSave === 'string') {
                              handleBookLinkSave(f.id, urlToSave);
                            }
                          }}
                          className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 border border-blue-500/50 px-3 py-1 text-[10px] font-mono uppercase tracking-widest"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isOwner && isShowingOrders && (
          <div className="w-96 bg-black/95 border border-[#FFBF00]/50 p-4 shadow-2xl backdrop-blur-xl mt-2 max-h-[500px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
            <h4 className="font-mono text-[#FFBF00] text-xs mb-4 uppercase flex items-center gap-2">
              <Smartphone className="w-3 h-3" /> Live Transaction Log
            </h4>
            {recentOrders.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono italic">Searching for recent orders...</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recentOrders.map((ro, i) => (
                  <div key={i} className="border border-green-500/20 p-3 text-[11px] font-mono bg-green-500/5 rounded-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-green-400 font-bold uppercase">Order Finalized</span>
                      <span className="text-gray-500 text-[9px]">{new Date(ro.timestamp || ro.time).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="space-y-1 mb-2">
                      <div className="text-gray-300">Customer: {ro.customerEmail}</div>
                      <div className="text-gray-300">Type: {ro.itemType}</div>
                    </div>

                    {ro.luluJobId ? (
                       <div className="mt-2 pt-2 border-t border-green-500/10">
                         <div className="text-green-400 flex items-center gap-2 mb-2">
                           Lulu Job: {ro.luluJobId}
                         </div>
                         {ro.verifiedStatus ? (
                           <div className="bg-blue-500/20 text-blue-300 p-2 border border-blue-500/30">
                             Lulu Status: {ro.verifiedStatus}
                           </div>
                         ) : (
                           <button 
                             onClick={() => verifyOrderStatus(ro.luluJobId, ro.id || ro.sessionId)}
                             className="w-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 py-1 transition-all"
                           >
                             Force Lulu Status Check
                           </button>
                         )}
                       </div>
                    ) : ro.luluError ? (
                       <div className="text-red-400 font-bold bg-red-950/20 border border-red-900/50 p-2">
                         System Error: {ro.luluError}
                       </div>
                    ) : (
                       <div className="text-yellow-400 animate-pulse font-bold bg-yellow-950/20 border border-yellow-900/50 p-2">
                         Processing Fulfillment Chain...
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-24">
        
        {/* Hero Section */}
        <section className="min-h-[80vh] flex flex-col items-center justify-center text-center section-transition py-20 relative">
          
          {!assets.monad ? (
            isOwner ? (
              <div className="w-64 h-64 md:w-80 md:h-80 mx-auto mb-12 border border-[#FFBF00]/30 border-dashed flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-sm relative z-20">
                {uploadingKey === 'monad' ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 mb-4 animate-spin text-[#FFBF00]" />
                    <span className="text-xs font-mono mt-2 text-[#FFBF00]">Saving...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-4 text-[#FFBF00]/70" />
                    <span className="font-serif tracking-widest text-sm uppercase text-center px-4 text-[#FFBF00]/70 mb-4">
                      Image Path or URL
                    </span>
                    <input 
                      type="text" 
                      placeholder="e.g. /monad.png" 
                      value={inputUrls.monad}
                      onChange={(e) => setInputUrls(prev => ({...prev, monad: e.target.value}))}
                      className="w-full bg-black/50 border border-[#FFBF00]/30 text-[#d4c5b0] px-3 py-2 text-xs font-mono mb-4 outline-none focus:border-[#FFBF00]/80 transition-colors"
                    />
                    <button 
                      onClick={() => handleUrlSave('monad', inputUrls.monad)}
                      disabled={!inputUrls.monad}
                      className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-4 py-1 text-xs font-serif uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      Save Path
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="w-64 h-64 md:w-80 md:h-80 mx-auto mb-12 border border-[#FFBF00]/10 flex items-center justify-center text-[#FFBF00]/20 font-serif italic">
                Awaiting Sigil...
              </div>
            )
          ) : (
            <div className="flex flex-col items-center mb-12">
              <img 
                src={assets.monad} 
                alt="Monad Sigil" 
                referrerPolicy="no-referrer"
                className="w-64 h-64 md:w-80 md:h-80 blend-monad object-contain"
              />
              {isOwner && (
                <div className="mt-4 flex gap-2 w-full max-w-xs relative z-20">
                  <input 
                    type="text" 
                    placeholder="Update path..." 
                    value={inputUrls.monad || assets.monad}
                    onChange={(e) => setInputUrls(prev => ({...prev, monad: e.target.value}))}
                    className="flex-1 bg-black/80 border border-[#FFBF00]/30 text-[#d4c5b0] px-2 py-1 text-xs font-mono outline-none focus:border-[#FFBF00]/80"
                  />
                  <button 
                    onClick={() => handleUrlSave('monad', inputUrls.monad || assets.monad)}
                    className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-3 py-1 text-xs font-serif uppercase tracking-widest"
                  >
                    {uploadingKey === 'monad' ? '...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )}

          <h1 className="font-serif text-5xl md:text-7xl mb-12 tracking-wider glow-text uppercase">
            The Awakening<br/>of the Spark
          </h1>
          <p className="text-xl md:text-2xl leading-relaxed max-w-2xl text-[#b5a691] italic">
            "The truth you've been looking for is hidden inside the parts of yourself you were taught to ignore. The walls of the prison are made of paper."
          </p>
        </section>

        <Divider />

        {/* Front Cover Anchor */}
        <section className="py-20 flex justify-center items-center section-transition relative min-h-[60vh]">
          {!assets.cover ? (
            isOwner ? (
              <div className="max-w-md md:max-w-lg w-full aspect-[2/3] border border-[#FFBF00]/30 border-dashed flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-sm relative z-20">
                {uploadingKey === 'cover' ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 mb-4 animate-spin text-[#FFBF00]" />
                    <span className="text-xs font-mono mt-2 text-[#FFBF00]">Saving...</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-4 text-[#FFBF00]/70" />
                    <span className="font-serif tracking-widest text-sm uppercase text-center px-4 text-[#FFBF00]/70 mb-6">
                      Image Path or URL
                    </span>
                    <input 
                      type="text" 
                      placeholder="e.g. /cover.jpeg" 
                      value={inputUrls.cover}
                      onChange={(e) => setInputUrls(prev => ({...prev, cover: e.target.value}))}
                      className="w-full bg-black/50 border border-[#FFBF00]/30 text-[#d4c5b0] px-3 py-2 text-xs font-mono mb-6 outline-none focus:border-[#FFBF00]/80 transition-colors"
                    />
                    <button 
                      onClick={() => handleUrlSave('cover', inputUrls.cover)}
                      disabled={!inputUrls.cover}
                      className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-6 py-2 text-sm font-serif uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      Save Path
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="max-w-md md:max-w-lg w-full aspect-[2/3] border border-[#FFBF00]/10 flex items-center justify-center text-[#FFBF00]/20 font-serif italic">
                Awaiting Manifestation...
              </div>
            )
          ) : (
            <div className="relative max-w-md md:max-w-lg w-full flex flex-col items-center">
              <div className="w-full blend-cover-wrapper relative">
                <img 
                  src={assets.cover} 
                  alt="The Awakening of the Spark - Front Cover" 
                  referrerPolicy="no-referrer"
                  className="w-full blend-cover object-contain shadow-2xl"
                />
                {/* Right-side lightening overlay */}
                <div className="absolute inset-0 bg-gradient-to-l from-[#d4c5b0]/30 via-transparent to-transparent pointer-events-none mix-blend-screen"></div>
              </div>
              {isOwner && (
                <div className="mt-4 flex gap-2 w-full relative z-20">
                  <input 
                    type="text" 
                    placeholder="Update path..." 
                    value={inputUrls.cover || assets.cover}
                    onChange={(e) => setInputUrls(prev => ({...prev, cover: e.target.value}))}
                    className="flex-1 bg-black/80 border border-[#FFBF00]/30 text-[#d4c5b0] px-2 py-1 text-xs font-mono outline-none focus:border-[#FFBF00]/80"
                  />
                  <button 
                    onClick={() => handleUrlSave('cover', inputUrls.cover || assets.cover)}
                    className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-3 py-1 text-xs font-serif uppercase tracking-widest"
                  >
                    {uploadingKey === 'cover' ? '...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <Divider />

        {/* The 5 Tribes of the Cage */}
        <section className="py-20">
          <h2 className="font-serif text-3xl md:text-4xl text-center mb-24 tracking-widest uppercase text-[#FFBF00]/80">The Five Tribes of the Cage</h2>
          
          <div className="space-y-32">
            {[
              { title: "The Believer in the Shadow", content: "For the person who was raised on the promise of a loving, universal Father but can no longer ignore the jealous warlord described in the text. You are tired of the spiritual gaslighting—being told to find peace in a book that revels in sacrifice and the scent of burnt flesh. This is for the soul that has outgrown the pews but still carries the weight of the altar." },
              { title: "The Captive of Scarcity", content: "For the person who realizes that debt, credit, and finance aren't just economic tools—they are a modern tax on the human spirit. You feel the constant pressure of manufactured lack, designed to keep you in a state of survival so you never have the energy to look inward. You are ready to see the financial siphon for what it truly is: a mechanism of extraction." },
              { title: "The Unwitting Builder", content: "For the person who has spent their life following the instructions, only to realize they have been building their own prison. You see the hierarchies and the systems of \"success\" and realize they are designed to keep you tiered, managed, and separated from your own power. You are tired of being the labor force for a blueprint you never agreed to." },
              { title: "The Harvested Mind", content: "For the person whose focus, time, and attention are being mined like raw material. You feel the exhaustion of a digital world that fragmentizes your spark and sells it back to you in pieces. You know that the \"Attention Economy\" isn't just about ads—it’s about ensuring you never have a silent moment to remember who you actually are." },
              { title: "The Seeker of the Ancient Exit", content: "For the person who knows in their gut that this cage is older than the modern world. You sense the ancient cycle of systems that rise up to wipe us out every time we start to look too far inward. You aren't looking for another \"system\" to join; you are looking for the forensic evidence of how to leave the cycle entirely and reclaim your own fire." }
            ].map((echo, idx) => (
              <div key={idx} className="flex flex-col items-center text-center max-w-2xl mx-auto section-transition py-12 px-6">
                <h3 className="font-serif text-2xl mb-8 tracking-wider text-[#d4c5b0]">{echo.title}</h3>
                <p className="text-lg leading-loose text-[#a39481]">{echo.content}</p>
                {idx < 4 && <div className="mt-24 text-[#FFBF00]/30">☩</div>}
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* The Spark (Action Section) */}
        <section className="py-32 relative flex flex-col items-center section-transition overflow-hidden min-h-screen justify-center">
          
          {/* Full Spread Image - Now inline instead of background */}
          {assets.spread && (
            <div className="w-full max-w-6xl mx-auto mb-16 px-4 relative z-10 flex flex-col items-center">
              <div className="relative inline-block w-full blend-spread-inline-wrapper">
                <img 
                  src={assets.spread} 
                  alt="Full Spread Texture" 
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-contain blend-spread-inline"
                />
                {/* Right-side lightening overlay */}
                <div className="absolute inset-0 bg-gradient-to-l from-[#d4c5b0]/30 via-transparent to-transparent pointer-events-none mix-blend-screen"></div>
              </div>
              {isOwner && (
                <div className="mt-4 flex gap-2 w-full max-w-md relative z-20">
                  <input 
                    type="text" 
                    placeholder="Update path..." 
                    value={inputUrls.spread || assets.spread}
                    onChange={(e) => setInputUrls(prev => ({...prev, spread: e.target.value}))}
                    className="flex-1 bg-black/80 border border-[#FFBF00]/30 text-[#d4c5b0] px-2 py-1 text-xs font-mono outline-none focus:border-[#FFBF00]/80"
                  />
                  <button 
                    onClick={() => handleUrlSave('spread', inputUrls.spread || assets.spread)}
                    className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-3 py-1 text-xs font-serif uppercase tracking-widest"
                  >
                    {uploadingKey === 'spread' ? '...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!assets.spread && isOwner && (
            <div className="w-full max-w-3xl mx-auto mb-16 border border-[#FFBF00]/30 border-dashed flex flex-col items-center justify-center p-12 relative z-50 bg-black/40 backdrop-blur-sm">
              {uploadingKey === 'spread' ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 mb-4 animate-spin text-[#FFBF00]" />
                  <span className="text-xs font-mono mt-2 text-[#FFBF00]">Saving...</span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mb-4 mx-auto text-[#FFBF00]/70" />
                  <span className="font-serif tracking-widest text-sm uppercase text-center text-[#FFBF00]/70 mb-6">
                    Image Path or URL (3 of 3)
                  </span>
                  <input 
                    type="text" 
                    placeholder="e.g. /spread.jpeg" 
                    value={inputUrls.spread}
                    onChange={(e) => setInputUrls(prev => ({...prev, spread: e.target.value}))}
                    className="w-full max-w-md bg-black/50 border border-[#FFBF00]/30 text-[#d4c5b0] px-3 py-2 text-xs font-mono mb-6 outline-none focus:border-[#FFBF00]/80 transition-colors"
                  />
                  <button 
                    onClick={() => handleUrlSave('spread', inputUrls.spread)}
                    disabled={!inputUrls.spread}
                    className="bg-[#FFBF00]/20 hover:bg-[#FFBF00]/40 text-[#FFBF00] border border-[#FFBF00]/50 px-6 py-2 text-sm font-serif uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    Save Path
                  </button>
                </>
              )}
            </div>
          )}

          <div className="relative z-10 max-w-3xl mx-auto text-center px-6 bg-black/40 p-8 md:p-16 rounded-xl backdrop-blur-sm border border-[#332b20]/50">
            <h2 className="font-serif text-3xl md:text-4xl mb-12 tracking-widest uppercase text-[#FFBF00]/80">The Excavation</h2>
            
            <div className="space-y-8 font-serif text-xl md:text-2xl text-[#d4c5b0] leading-relaxed mb-24">
              <p className="font-bold tracking-wider text-[#FFBF00] text-2xl md:text-3xl">
                YOU ALREADY KNOW THE WORLD IS EXHAUSTING.
              </p>
              <p className="italic">
                The system isn't broken; it is functioning exactly as designed.
              </p>
              <p className="text-lg md:text-xl text-[#b5a691]">
                The Awakening of the Spark is the excavation. Across 63 chapters, Frederick Seän Beesley M.∴ M.∴ synthesizes suppressed Gnostic history and esoteric geometry to provide the blueprint to reclaim your stolen fire.
              </p>
            </div>

            <div className="w-full mb-24">
              <MediaPlayer 
                url={assets.narration} 
                onSaveUrl={(url) => handleUrlSave('narration', url)} 
                isUploading={uploadingKey === 'narration'}
                isOwner={isOwner}
              />
            </div>

            {/* Acquisition Tiers (API Prepped) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto mb-16">
              {/* Hardcover */}
              <div className="bg-black/60 border border-[#FFBF00]/20 p-8 rounded-lg backdrop-blur-md flex flex-col items-center hover:border-[#FFBF00]/50 transition-colors">
                <div className="text-[#FFBF00] mb-4">
                  <Book className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="font-serif text-xl mb-4 tracking-widest text-[#FFBF00]/80 uppercase">Hardcover</h3>
                <p className="text-sm text-[#a39481] mb-8 font-serif italic text-center">Premium print edition</p>
                <div className="flex flex-col gap-4 w-full mt-auto">
                  {bookLinks.hardcoverLuluUrl ? (
                    <a 
                      href={bookLinks.hardcoverLuluUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full border border-[#FFBF00]/40 text-[#FFBF00] px-4 py-3 text-xs font-serif uppercase tracking-widest hover:bg-[#FFBF00]/10 transition-all text-center inline-block"
                    >
                      Acquire Hardcover
                    </a>
                  ) : (
                    <button disabled className="w-full border border-[#FFBF00]/20 text-[#FFBF00]/50 px-4 py-3 text-xs font-serif uppercase tracking-widest text-center cursor-not-allowed">
                      Coming Soon
                    </button>
                  )}
                </div>
              </div>

              {/* Softcover */}
              <div className="bg-black/60 border border-[#FFBF00]/20 p-8 rounded-lg backdrop-blur-md flex flex-col items-center hover:border-[#FFBF00]/50 transition-colors">
                <div className="text-[#FFBF00] mb-4">
                  <Book className="w-8 h-8 opacity-50" />
                </div>
                <h3 className="font-serif text-xl mb-4 tracking-widest text-[#FFBF00]/80 uppercase">Softcover</h3>
                <p className="text-sm text-[#a39481] mb-8 font-serif italic text-center">Standard print edition</p>
                <div className="flex flex-col gap-4 w-full h-full justify-between mt-auto">
                  {bookLinks.softcoverLuluUrl ? (
                    <a 
                      href={bookLinks.softcoverLuluUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full border border-[#FFBF00]/40 text-[#FFBF00] px-4 py-3 text-xs font-serif uppercase tracking-widest hover:bg-[#FFBF00]/10 transition-all text-center inline-block"
                    >
                      Acquire Softcover
                    </a>
                  ) : (
                    <button disabled className="w-full border border-[#FFBF00]/20 text-[#FFBF00]/50 px-4 py-3 text-xs font-serif uppercase tracking-widest text-center cursor-not-allowed">
                      Coming Soon
                    </button>
                  )}
                </div>
              </div>

              {/* Ebook */}
              <div className="bg-[#111111]/80 border border-[#FFBF00]/30 p-8 rounded-lg backdrop-blur-md flex flex-col items-center ring-1 ring-[#FFBF00]/10 hover:ring-[#FFBF00]/40 transition-all">
                <div className="text-[#FFBF00] mb-4 animate-pulse">
                  <Smartphone className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-xl mb-4 tracking-widest text-[#FFBF00] uppercase">Digital Ebook</h3>
                <p className="text-sm text-[#FFBF00]/60 mb-8 font-serif italic text-center">Instant secure download</p>
                <div className="flex flex-col gap-4 w-full mt-auto">
                  <form action="/api/checkout" method="POST" target="_blank" className="w-full">
                    <input type="hidden" name="itemType" value="ebook" />
                    <button 
                      type="submit"
                      className="w-full bg-[#FFBF00]/20 border border-[#FFBF00] text-[#FFBF00] px-4 py-3 text-xs font-serif uppercase tracking-widest hover:bg-[#FFBF00]/40 transition-all text-center shadow-[0_0_15px_rgba(255,191,0,0.1)]"
                    >
                      Acquire Digital
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About the Author Section */}
        <section className="w-full py-32 relative z-10 px-4 md:px-8 bg-black/30 border-y border-[#332b20]/30">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-16 items-start">
              {/* Author Photo */}
              <div className="w-full md:w-1/3 shrink-0 mx-auto md:mx-0 max-w-xs md:max-w-none">
                <div className="aspect-[3/4] relative border border-[#FFBF00]/20 p-2 bg-black/40 shadow-2xl overflow-hidden group">
                  <img 
                    src="/author_final.jpg" 
                    alt="Frederick Seän Beesley" 
                    className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-[1500ms] ease-out scale-105 group-hover:scale-100"
                  />
                  <div className="absolute inset-0 pointer-events-none border border-[#FFBF00]/10 m-4 transition-all duration-700 group-hover:m-2"></div>
                </div>
              </div>

              {/* Author Bio */}
              <div className="flex-1">
                <h2 className="font-serif text-3xl mb-10 tracking-[0.2em] text-[#FFBF00] uppercase text-center md:text-left underline decoration-[#FFBF00]/20 underline-offset-8">About the Author</h2>
                
                <div className="font-serif text-[#a39481]/90 leading-relaxed space-y-8">
                  <p className="text-xl italic tracking-wide text-[#d4c5b0] leading-relaxed">
                    Frederick Seän Beesley is a Canadian author, musician, and lifelong researcher of ancient history and esoteric traditions.
                  </p>

                  {isBioExpanded ? (
                    <div className="animate-in fade-in duration-1000 space-y-8 text-base">
                      <p>
                        Born into the epicenter of the Pentecostal "Latter Rain" movement, Frederick is the grandson of two founding fathers of the modern Pentecostal Church. Raised amidst revivalism and prophecy, he was expected to inherit the pulpit. Instead, he stepped back. Even as a child, he possessed a quiet, observant nature that noticed the divide between the spiritual truths being preached and the mechanisms of control being practiced.
                      </p>
                      <p>
                        Refusing the family calling, he left the church at eighteen and found his first sanctuary in the underground music scene of Toronto. Throughout the late eighties and nineties, he worked as a producer and musician, living in the trenches of frequency and sound. Yet, the drive to understand the "architecture of belief" never left him. Over the next few decades, his path became a relentless pursuit of the suppressed histories that institutions had spent 2,000 years trying to bury. He studied mystic alchemy, explored the geometry of the Lodge as a Master Freemason, and grounded his research through Yale’s Open Source Ancient History curriculum.
                      </p>
                      <p>
                        Like many, Frederick eventually traded his creative life for the corporate world, spending nearly two decades as a national manager. This experience provided a stark realization: the modern corporate machine and the rigid religious institutions of his youth utilized the exact same systems to harvest human time, energy, and creativity.
                      </p>
                      <p>
                        In 2020, a severe illness forced a sudden medical retirement, stripping away the illusion of corporate security. In that profound stillness, a lifetime of observation and esoteric research finally synthesized. Frederick recognized that the ideas historically labeled as "heresy" or "poison" by those in power were often just the bitter medicine required for individual freedom.
                      </p>
                      <p>
                        Today, operating Shadow Point Press, Frederick’s goal is to share that medicine. His work explores the intersection of Gnosticism, psychology, and personal sovereignty.
                      </p>
                      <div className="pt-8 border-t border-[#332b20]/50">
                        <p className="font-bold text-[#FFBF00]/80 italic">
                          His debut book, The Awakening of the Spark, isn't just a memoir or a historical text; it is a disruptive framework. It is written specifically for the relentless seekers, the quiet observers, and anyone who feels a deep, intuitive dissonance with the modern world and is finally looking for the map out.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-700">
                      <p className="text-base opacity-70 leading-relaxed">
                        Operating Shadow Point Press, Frederick's work explores the intersection of Gnosticism, psychology, and personal sovereignty...
                      </p>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="mt-4 text-xs font-mono tracking-[0.3em] text-[#FFBF00]/60 uppercase hover:text-[#FFBF00] transition-all flex items-center gap-3 group bg-transparent border-none cursor-pointer p-0"
                  >
                    <span className="group-hover:translate-x-1 transition-transform">{isBioExpanded ? '▾' : '▿'}</span>
                    {isBioExpanded ? 'Read Less' : 'Read Full Bio'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="w-full bg-black/60 border-t border-[#332b20] mt-32 py-16 relative z-30 px-4 md:px-8 text-center backdrop-blur-md">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-mono tracking-[0.2em] text-[#a39481]/60 uppercase mb-8">
            © 2026 Shadow Point Press & Frederick Seän Beesley M.∴ M.∴ — All rights suppressed.
          </div>
          <div className="border-t border-[#332b20]/50 pt-8">
            <button 
              onClick={() => {
                const el = document.getElementById('policy-text');
                if (el) el.classList.toggle('hidden');
              }}
              className="text-[13px] font-mono tracking-[0.2em] text-[#a39481]/60 uppercase hover:text-[#a39481]/90 transition-all cursor-pointer bg-transparent border-none py-2"
            >
              ▾ Purchase Terms & Refund Policy ▾
            </button>
            <div id="policy-text" className="hidden mt-8 text-left space-y-6 text-sm font-mono text-[#a39481]/70 leading-relaxed max-w-2xl mx-auto bg-black/20 p-6 border border-[#332b20]/20">
              <p><span className="text-[#a39481] uppercase tracking-wider font-bold">Digital Content:</span> All sales of eBooks and digital downloads are final. Once a download link is issued, we cannot offer refunds except in cases of accidental duplicate purchases or verified technical access issues.</p>
              <p><span className="text-[#a39481] uppercase tracking-wider font-bold">Physical Books:</span> Orders for physical copies are fulfilled via third-party partners (Lulu/KDP). For issues regarding shipping damage, printing defects, or delivery tracking, please contact the specific distributor's support team.</p>
              <p><span className="text-[#a39481] uppercase tracking-wider font-bold">General:</span> By purchasing from Shadow Point Press / Frederick Sean Beesley, you agree that this intellectual property is for personal use only. All content is the property of the author.</p>
              <p className="pt-4 border-t border-[#332b20]/30"><span className="text-[#a39481] uppercase tracking-wider font-bold">Contact:</span> <a href="mailto:contact@theawakeningofthespark.com" className="text-[#FFBF00]/60 hover:text-[#FFBF00] transition-colors border-b border-[#FFBF00]/20">contact@theawakeningofthespark.com</a></p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
