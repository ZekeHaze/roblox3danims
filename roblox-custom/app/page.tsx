'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import styles from './dashboard.module.css';

// Importación dinámica limpia de Scene3D sin SSR ni errores de tipos
const Scene3D = dynamic(() => import('./Scene3D'), {
  ssr: false,
  loading: () => (
    <div style={{ color: '#60a5fa', textAlign: 'center', padding: '2rem' }}>
      Cargando Visor 3D...
    </div>
  ),
});

const DEFAULT_USER = 'ZekeClanO';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rig3d'>('dashboard');
  const [searchInput, setSearchInput] = useState(DEFAULT_USER);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/roblox-avatar?query=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (res.ok) {
        setProfile(data);
      } else {
        setError(data.error || 'No se pudo obtener el usuario');
        setProfile(null);
      }
    } catch (err) {
      setError('Error al conectar con el servidor.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(DEFAULT_USER);
  }, []);

  return (
    <main className={styles.container}>
      <div className={styles.wrapper}>
        
        {/* Encabezado */}
        <header className={styles.header}>
          <h1 className={styles.title}>Inspector & Visor Roblox 3D</h1>
          <p className={styles.subtitle}>
            Inspecciona perfiles de Roblox o visualiza modelos 3D en formato OBJ
          </p>
        </header>

        {/* NAVEGACIÓN ENTRE PESTAÑAS */}
        <div className={styles.navTabs}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`${styles.tabButton} ${activeTab === 'dashboard' ? styles.tabButtonActive : ''}`}
          >
            📊 Dashboard Perfil
          </button>
          <button
            onClick={() => setActiveTab('rig3d')}
            className={`${styles.tabButton} ${activeTab === 'rig3d' ? styles.tabButtonActive : ''}`}
          >
            🧊 Visualizador 3D OBJ
          </button>
        </div>

        {/* APARTADO 1: DASHBOARD TRADICIONAL */}
        {activeTab === 'dashboard' && (
          <>
            {/* Buscador de usuario exclusivo para Dashboard */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchProfile(searchInput);
              }}
              className={styles.searchForm}
            >
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar Username o ID..."
                className={styles.searchInput}
              />
              <button type="submit" disabled={loading} className={styles.searchButton}>
                {loading ? 'Cargando...' : 'Buscar'}
              </button>
            </form>

            {error && (
              <div style={{ padding: '1rem', backgroundColor: '#451a1a', border: '1px solid #7f1d1d', borderRadius: '12px', color: '#fca5a5', textAlign: 'center', marginBottom: '2rem' }}>
                ⚠️ {error}
              </div>
            )}

            {profile && (
              <div className={styles.grid3Col}>
                
                {/* COLUMNA 1: PERFIL */}
                <div className={`${styles.card} ${styles.profileCard}`}>
                  {profile.headshotUrl && (
                    <img
                      src={profile.headshotUrl}
                      alt={profile.displayName}
                      className={styles.avatarHeadshot}
                    />
                  )}
                  <h2 className={styles.displayName}>{profile.displayName}</h2>
                  <p className={styles.username}>@{profile.name}</p>

                  <div className={styles.infoBox}>
                    <div className={styles.infoRow}>
                      <span>User ID:</span>
                      <strong style={{ color: '#fff' }}>{profile.id}</strong>
                    </div>
                    <div className={styles.infoRow}>
                      <span>Miembro desde:</span>
                      <strong style={{ color: '#fff' }}>{new Date(profile.created).toLocaleDateString()}</strong>
                    </div>
                    <div className={styles.infoRow}>
                      <span>Tipo Original:</span>
                      <strong style={{ color: '#60a5fa' }}>{profile.avatarType}</strong>
                    </div>
                    <div className={styles.infoRow}>
                      <span>Estado:</span>
                      <strong style={{ color: profile.isBanned ? '#f87171' : '#4ade80' }}>
                        {profile.isBanned ? 'Suspendida' : 'Activa'}
                      </strong>
                    </div>
                  </div>

                  {profile.description && (
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', backgroundColor: '#030712', padding: '0.75rem', borderRadius: '10px', border: '1px solid #1f2937', marginTop: '1rem' }}>
                      "{profile.description}"
                    </p>
                  )}
                </div>

                {/* COLUMNA 2: MODELO COMPLETO */}
                <div className={`${styles.card} ${styles.modelCard}`}>
                  <span className={styles.cardTitle}>Render de Personaje</span>
                  {profile.fullBodyUrl ? (
                    <img
                      src={profile.fullBodyUrl}
                      alt={profile.name}
                      className={styles.fullBodyImage}
                    />
                  ) : (
                    <p style={{ color: '#6b7280' }}>Sin vista previa</p>
                  )}
                </div>

                {/* COLUMNA 3: OBJETOS EQUIPADOS */}
                <div className={`${styles.card} ${styles.itemsCard}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid #1f2937' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>Objetos Equipados</h3>
                    <span style={{ backgroundColor: '#1f2937', color: '#60a5fa', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {profile.assets?.length || 0}
                    </span>
                  </div>

                  <div className={styles.itemList}>
                    {profile.assets && profile.assets.length > 0 ? (
                      profile.assets.map((item: any) => (
                        <div key={item.id} className={styles.itemCard}>
                          <div className={styles.itemInfoWrapper}>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className={styles.itemThumb}
                              />
                            ) : (
                              <div
                                className={styles.itemThumb}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#4b5563' }}
                              >
                                📦
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <p className={styles.itemName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.name}
                              </p>
                              <p className={styles.itemMeta}>
                                {item.type} • ID: {item.id}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`https://www.roblox.com/catalog/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.catalogButton}
                          >
                            Ver ↗
                          </a>
                        </div>
                      ))
                    ) : (
                      <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', margin: '2rem 0' }}>
                        Sin objetos equipados
                      </p>
                    )}
                  </div>
                </div>

              </div>
            )}
          </>
        )}

        {/* APARTADO 2: VISOR 3D INDEPENDIENTE */}
        {activeTab === 'rig3d' && (
          <div className={styles.rigContainer}>
            <div className={styles.view3DCard}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>
                  Visor 3D OBJ
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#9ca3af' }}>
                  Explora libremente el modelo 3D independiente
                </p>
              </div>

              {/* Viewport 3D independiente */}
              <div className={styles.viewport3D} style={{ height: '600px', borderRadius: '12px', overflow: 'hidden' }}>
                <Scene3D />
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}