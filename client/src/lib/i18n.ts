import { useAuth } from '@/hooks/useAuth';

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it';

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    // Navigation
    nav_discover: 'Discover',
    nav_shelf: 'Library',
    nav_stats: 'Stats',
    nav_admin: 'Admin',
    nav_sign_out: 'Sign Out',
    nav_sign_in: 'Sign In',
    nav_spotify_connected: 'Spotify Connected',
    nav_connect_spotify: 'Connect Spotify',

    // Header & User
    logged_in_as: 'Logged in as',
    settings: 'Settings',
    logout: 'Logout',

    // Daily Word / Discover
    word_of_the_day: 'Word of the Day',
    hear_it: 'Hear it',
    pause: 'Pause',
    playlist: 'Playlist',
    spotify: 'Spotify',
    share: 'Share',
    next_word: 'Next Word',
    lyric_snippet: 'Lyric Snippet',
    difficulty: 'Difficulty',
    cefr_level: 'CEFR Level',
    generated_from: 'Generated from track',
    playing_pronunciation: 'Playing pronunciation…',
    playing_song_clip: 'Playing song snippet…',
    pronounce_word: 'Pronounce Word',
    meaning: 'Meaning',
    tap_to_flip: 'Tap card to flip',
    tap_to_flip_back: 'Tap to flip back',
    tap_for_context: 'Tap for song context',
    open_in_spotify: 'Open in Spotify',
    add_to_playlist: 'Add to my playlist',
    found_in: 'Found in',
    in_this_line: 'In this line',
    search_song_for_word: 'Search a song for a word from its lyrics…',
    learn_word_from_song: 'Learn a word',

    // Shelf / Review / Library
    shelf_title: 'Vocabulary Shelf',
    shelf_subtitle: 'Review & master your saved song vocabulary',
    saved_words: 'Saved Words',
    due_review: 'Due for Review',
    mark_learned: 'Mark Learned',
    remove: 'Remove',
    empty_shelf: 'No saved words yet. Tap "+ Playlist" on Discover to add words!',
    new_playlist: 'New Playlist',
    playlist_name: 'Playlist Name',
    create: 'Create',
    cancel: 'Cancel',

    // Stats
    stats_title: 'Learning Stats',
    streak: 'Day Streak',
    total_learned: 'Words Learned',
    daily_goal: 'Daily Goal',
    mastery_progress: 'Mastery Progress',

    // Settings & Profile
    settings_title: 'Account Settings',
    home_language_ui: 'Home / App UI Language',
    target_language: 'Learning Language',
    music_genre: 'Music Genre Preference',
    voice_gender: 'Pronunciation Voice Gender',
    voice_female: 'Female',
    voice_male: 'Male',
    save_settings: 'Save Preferences',
    saving: 'Saving…',
    settings_saved: 'Settings saved successfully!',

    // Share & Modals
    share_postcard: 'Share Word Postcard',
    download_png: 'Download PNG',
    copy_link: 'Copy Link',
    link_copied: 'Link Copied',

    // Common / Auth
    loading: 'Loading…',
    error: 'Error',
    close: 'Close',
    back: 'Back',
  },
  es: {
    // Navigation
    nav_discover: 'Descubrir',
    nav_shelf: 'Biblioteca',
    nav_stats: 'Estadísticas',
    nav_admin: 'Admin',
    nav_sign_out: 'Cerrar Sesión',
    nav_sign_in: 'Iniciar Sesión',
    nav_spotify_connected: 'Spotify Conectado',
    nav_connect_spotify: 'Conectar Spotify',

    // Header & User
    logged_in_as: 'Sesión iniciada como',
    settings: 'Ajustes',
    logout: 'Cerrar Sesión',

    // Daily Word / Discover
    word_of_the_day: 'Palabra del Día',
    hear_it: 'Escuchar',
    pause: 'Pausa',
    playlist: 'Guardar',
    spotify: 'Spotify',
    share: 'Compartir',
    next_word: 'Siguiente Palabra',
    lyric_snippet: 'Fragmento de Letra',
    difficulty: 'Dificultad',
    cefr_level: 'Nivel MCER',
    generated_from: 'Generado de la canción',
    playing_pronunciation: 'Reproduciendo pronunciación…',
    playing_song_clip: 'Reproduciendo fragmento…',
    pronounce_word: 'Pronunciar Palabra',
    meaning: 'Significado',
    tap_to_flip: 'Toca la tarjeta para voltear',
    tap_to_flip_back: 'Toca para volver',
    tap_for_context: 'Toca para ver contexto',
    open_in_spotify: 'Abrir en Spotify',
    add_to_playlist: 'Añadir a mi lista',
    found_in: 'Encontrado en',
    in_this_line: 'En esta línea',
    search_song_for_word: 'Busca una canción para sacar una palabra de la letra…',
    learn_word_from_song: 'Aprender una palabra',

    // Shelf / Review / Library
    shelf_title: 'Estantería de Vocabulario',
    shelf_subtitle: 'Repasa y domina tus palabras guardadas',
    saved_words: 'Palabras Guardadas',
    due_review: 'Pendientes de Repaso',
    mark_learned: 'Marcar Aprendida',
    remove: 'Eliminar',
    empty_shelf: '¡Aún no hay palabras guardadas! Pulsa "+ Guardar" en Descubrir.',
    new_playlist: 'Nueva Lista',
    playlist_name: 'Nombre de la Lista',
    create: 'Crear',
    cancel: 'Cancelar',

    // Stats
    stats_title: 'Estadísticas de Aprendizaje',
    streak: 'Racha de Días',
    total_learned: 'Palabras Aprendidas',
    daily_goal: 'Meta Diaria',
    mastery_progress: 'Progreso de Dominio',

    // Settings & Profile
    settings_title: 'Ajustes de Cuenta',
    home_language_ui: 'Idioma de la App (Interfaz)',
    target_language: 'Idioma que Aprendes',
    music_genre: 'Preferencia de Género Musical',
    voice_gender: 'Género de Voz de Pronunciación',
    voice_female: 'Femenina',
    voice_male: 'Masculina',
    save_settings: 'Guardar Preferencias',
    saving: 'Guardando…',
    settings_saved: '¡Ajustes guardados correctamente!',

    // Share & Modals
    share_postcard: 'Compartir Postal de Palabra',
    download_png: 'Descargar PNG',
    copy_link: 'Copiar Enlace',
    link_copied: 'Enlace Copiado',

    // Common / Auth
    loading: 'Cargando…',
    error: 'Error',
    close: 'Cerrar',
    back: 'Volver',
  },
  fr: {
    // Navigation
    nav_discover: 'Découvrir',
    nav_shelf: 'Bibliothèque',
    nav_stats: 'Statistiques',
    nav_admin: 'Admin',
    nav_sign_out: 'Déconnexion',
    nav_sign_in: 'Connexion',
    nav_spotify_connected: 'Spotify Connecté',
    nav_connect_spotify: 'Connecter Spotify',

    // Header & User
    logged_in_as: 'Connecté en tant que',
    settings: 'Paramètres',
    logout: 'Déconnexion',

    // Daily Word / Discover
    word_of_the_day: 'Mot du Jour',
    hear_it: 'Écouter',
    pause: 'Pause',
    playlist: 'Sauvegarder',
    spotify: 'Spotify',
    share: 'Partager',
    next_word: 'Mot Suivant',
    lyric_snippet: 'Extrait de Paroles',
    difficulty: 'Difficulté',
    cefr_level: 'Niveau CECRL',
    generated_from: 'Généré à partir de la chanson',
    playing_pronunciation: 'Lecture de la prononciation…',
    playing_song_clip: 'Lecture de l’extrait…',
    pronounce_word: 'Prononcer le Mot',
    meaning: 'Signification',
    tap_to_flip: 'Touchez pour retourner',
    tap_to_flip_back: 'Touchez pour revenir',
    tap_for_context: 'Touchez pour le contexte',
    open_in_spotify: 'Ouvrir dans Spotify',
    add_to_playlist: 'Ajouter à ma playlist',
    found_in: 'Trouvé dans',
    in_this_line: 'Dans cette ligne',
    search_song_for_word: 'Cherchez une chanson pour en tirer un mot…',
    learn_word_from_song: 'Apprendre un mot',

    // Shelf / Review / Library
    shelf_title: 'Étagère de Vocabulaire',
    shelf_subtitle: 'Révisez et maîtrisez vos mots enregistrés',
    saved_words: 'Mots Enregistrés',
    due_review: 'À Réviser',
    mark_learned: 'Marquer comme Appris',
    remove: 'Supprimer',
    empty_shelf: 'Aucun mot enregistré. Appuyez sur "+ Sauvegarder" dans Découvrir !',
    new_playlist: 'Nouvelle Playlist',
    playlist_name: 'Nom de la Playlist',
    create: 'Créer',
    cancel: 'Annuler',

    // Stats
    stats_title: 'Statistiques d’Apprentissage',
    streak: 'Série de Jours',
    total_learned: 'Mots Appris',
    daily_goal: 'Objectif Quotidien',
    mastery_progress: 'Progression de Maîtrise',

    // Settings & Profile
    settings_title: 'Paramètres du Compte',
    home_language_ui: 'Langue de l’Application (UI)',
    target_language: 'Langue à Apprendre',
    music_genre: 'Préférence de Genre Musical',
    voice_gender: 'Genre de la Voix de Prononciation',
    voice_female: 'Féminine',
    voice_male: 'Masculine',
    save_settings: 'Enregistrer les Préférences',
    saving: 'Enregistrement…',
    settings_saved: 'Paramètres enregistrés avec succès !',

    // Share & Modals
    share_postcard: 'Partager la Carte Vocabulaire',
    download_png: 'Télécharger PNG',
    copy_link: 'Copier le Lien',
    link_copied: 'Lien Copié',

    // Common / Auth
    loading: 'Chargement…',
    error: 'Erreur',
    close: 'Fermer',
    back: 'Retour',
  },
  de: {
    // Navigation
    nav_discover: 'Entdecken',
    nav_shelf: 'Bibliothek',
    nav_stats: 'Statistiken',
    nav_admin: 'Admin',
    nav_sign_out: 'Abmelden',
    nav_sign_in: 'Anmelden',
    nav_spotify_connected: 'Spotify Verbunden',
    nav_connect_spotify: 'Spotify Verbinden',

    // Header & User
    logged_in_as: 'Angemeldet als',
    settings: 'Einstellungen',
    logout: 'Abmelden',

    // Daily Word / Discover
    word_of_the_day: 'Wort des Tages',
    hear_it: 'Anhören',
    pause: 'Pause',
    playlist: 'Speichern',
    spotify: 'Spotify',
    share: 'Teilen',
    next_word: 'Nächstes Wort',
    lyric_snippet: 'Liedtext-Ausschnitt',
    difficulty: 'Schwierigkeit',
    cefr_level: 'GER-Stufe',
    generated_from: 'Generiert aus dem Song',
    playing_pronunciation: 'Aussprache wird abgespielt…',
    playing_song_clip: 'Song-Ausschnitt wird abgespielt…',
    pronounce_word: 'Wort aussprechen',
    meaning: 'Bedeutung',
    tap_to_flip: 'Tippen zum Drehen',
    tap_to_flip_back: 'Tippen zum Zurückdrehen',
    tap_for_context: 'Tippen für Songkontext',
    open_in_spotify: 'In Spotify öffnen',
    add_to_playlist: 'Zur Playlist hinzufügen',
    found_in: 'Gefunden in',
    in_this_line: 'In dieser Zeile',
    search_song_for_word: 'Suche einen Song, um ein Wort aus dem Text zu lernen…',
    learn_word_from_song: 'Wort lernen',

    // Shelf / Review / Library
    shelf_title: 'Wortschatz-Sammlung',
    shelf_subtitle: 'Wiederhole und meistere deine gespeicherten Wörter',
    saved_words: 'Gespeicherte Wörter',
    due_review: 'Fällig zur Wiederholung',
    mark_learned: 'Als Gelernt markieren',
    remove: 'Entfernen',
    empty_shelf: 'Noch keine Wörter gespeichert. Tippe auf "+ Speichern" bei Entdecken!',
    new_playlist: 'Neue Playlist',
    playlist_name: 'Playlist-Name',
    create: 'Erstellen',
    cancel: 'Abbrechen',

    // Stats
    stats_title: 'Lern-Statistiken',
    streak: 'Tages-Serie',
    total_learned: 'Gelernte Wörter',
    daily_goal: 'Tagesziel',
    mastery_progress: 'Fortschritt',

    // Settings & Profile
    settings_title: 'Konto-Einstellungen',
    home_language_ui: 'App-Sprache (Benutzeroberfläche)',
    target_language: 'Lernsprache',
    music_genre: 'Musikgenre-Bevorzugung',
    voice_gender: 'Aussprache-Stimme',
    voice_female: 'Weiblich',
    voice_male: 'Männlich',
    save_settings: 'Einstellungen Speichern',
    saving: 'Speichert…',
    settings_saved: 'Einstellungen erfolgreich gespeichert!',

    // Share & Modals
    share_postcard: 'Wortkarte Teilen',
    download_png: 'PNG Herunterladen',
    copy_link: 'Link Kopieren',
    link_copied: 'Link Kopiert',

    // Common / Auth
    loading: 'Lädt…',
    error: 'Fehler',
    close: 'Schließen',
    back: 'Zurück',
  },
  pt: {
    // Navigation
    nav_discover: 'Descobrir',
    nav_shelf: 'Biblioteca',
    nav_stats: 'Estatísticas',
    nav_admin: 'Admin',
    nav_sign_out: 'Sair',
    nav_sign_in: 'Entrar',
    nav_spotify_connected: 'Spotify Conectado',
    nav_connect_spotify: 'Conectar Spotify',

    // Header & User
    logged_in_as: 'Conectado como',
    settings: 'Configurações',
    logout: 'Sair',

    // Daily Word / Discover
    word_of_the_day: 'Palavra do Dia',
    hear_it: 'Ouvir',
    pause: 'Pausa',
    playlist: 'Salvar',
    spotify: 'Spotify',
    share: 'Compartilhar',
    next_word: 'Próxima Palavra',
    lyric_snippet: 'Trecho da Letra',
    difficulty: 'Dificuldade',
    cefr_level: 'Nível CEFR',
    generated_from: 'Gerado da música',
    playing_pronunciation: 'Reproduzindo pronúncia…',
    playing_song_clip: 'Reproduzindo trecho…',
    pronounce_word: 'Pronunciar Palavra',
    meaning: 'Significado',
    tap_to_flip: 'Toque para virar o cartão',
    tap_to_flip_back: 'Toque para voltar',
    tap_for_context: 'Toque para ver o contexto',
    open_in_spotify: 'Abrir no Spotify',
    add_to_playlist: 'Adicionar à minha playlist',
    found_in: 'Encontrado em',
    in_this_line: 'Nesta linha',
    search_song_for_word: 'Pesquise uma música para aprender uma palavra da letra…',
    learn_word_from_song: 'Aprender uma palavra',

    // Shelf / Review / Library
    shelf_title: 'Estante de Vocabulário',
    shelf_subtitle: 'Revise e domine suas palavras salvas',
    saved_words: 'Palavras Salvas',
    due_review: 'Para Revisar',
    mark_learned: 'Marcar como Aprendida',
    remove: 'Remover',
    empty_shelf: 'Nenhuma palavra salva ainda. Toque em "+ Salvar" em Descobrir!',
    new_playlist: 'Nova Playlist',
    playlist_name: 'Nome da Playlist',
    create: 'Criar',
    cancel: 'Cancelar',

    // Stats
    stats_title: 'Estatísticas de Aprendizado',
    streak: 'Sequência de Dias',
    total_learned: 'Palavras Aprendidas',
    daily_goal: 'Meta Diária',
    mastery_progress: 'Progresso de Domínio',

    // Settings & Profile
    settings_title: 'Configurações da Conta',
    home_language_ui: 'Idioma do App (Interface)',
    target_language: 'Idioma em Aprendizado',
    music_genre: 'Gênero Musical Preferido',
    voice_gender: 'Gênero da Voz de Pronúncia',
    voice_female: 'Feminino',
    voice_male: 'Masculino',
    save_settings: 'Salvar Preferências',
    saving: 'Salvando…',
    settings_saved: 'Configurações salvas com sucesso!',

    // Share & Modals
    share_postcard: 'Compartilhar Cartão de Palavra',
    download_png: 'Baixar PNG',
    copy_link: 'Copiar Link',
    link_copied: 'Link Copiado',

    // Common / Auth
    loading: 'Carregando…',
    error: 'Erro',
    close: 'Fechar',
    back: 'Voltar',
  },
  it: {
    // Navigation
    nav_discover: 'Scopri',
    nav_shelf: 'Libreria',
    nav_stats: 'Statistiche',
    nav_admin: 'Admin',
    nav_sign_out: 'Disconnetti',
    nav_sign_in: 'Accedi',
    nav_spotify_connected: 'Spotify Connesso',
    nav_connect_spotify: 'Connetti Spotify',

    // Header & User
    logged_in_as: 'Connesso come',
    settings: 'Impostazioni',
    logout: 'Disconnetti',

    // Daily Word / Discover
    word_of_the_day: 'Parola del Giorno',
    hear_it: 'Ascolta',
    pause: 'Pausa',
    playlist: 'Salva',
    spotify: 'Spotify',
    share: 'Condividi',
    next_word: 'Prossima Parola',
    lyric_snippet: 'Estratto del Testo',
    difficulty: 'Difficoltà',
    cefr_level: 'Livello QCER',
    generated_from: 'Generato dal brano',
    playing_pronunciation: 'Riproduzione pronuncia…',
    playing_song_clip: 'Riproduzione estratto…',
    pronounce_word: 'Pronuncia Parola',
    meaning: 'Significato',
    tap_to_flip: 'Tocca per girare la carta',
    tap_to_flip_back: 'Tocca per tornare indietro',
    tap_for_context: 'Tocca per il contesto',
    open_in_spotify: 'Apri in Spotify',
    add_to_playlist: 'Aggiungi alla mia playlist',
    found_in: 'Trovato in',
    in_this_line: 'In questo verso',
    search_song_for_word: 'Cerca una canzone per imparare una parola dal testo…',
    learn_word_from_song: 'Impara una parola',

    // Shelf / Review / Library
    shelf_title: 'Scaffale Vocabolario',
    shelf_subtitle: 'Ripassa e impara le parole salvate',
    saved_words: 'Parole Salvate',
    due_review: 'Da Ripassare',
    mark_learned: 'Segna come Imparata',
    remove: 'Rimuovi',
    empty_shelf: 'Nessuna parola salvata. Tocca "+ Salva" in Scopri per iniziare!',
    new_playlist: 'Nuova Playlist',
    playlist_name: 'Nome Playlist',
    create: 'Crea',
    cancel: 'Annulla',

    // Stats
    stats_title: 'Statistiche di Apprendimento',
    streak: 'Serie di Giorni',
    total_learned: 'Parole Imparate',
    daily_goal: 'Obiettivo Giornaliero',
    mastery_progress: 'Progresso di Dominio',

    // Settings & Profile
    settings_title: 'Impostazioni Account',
    home_language_ui: 'Lingua App (Interfaccia)',
    target_language: 'Lingua da Imparare',
    music_genre: 'Genere Musicale Preferito',
    voice_gender: 'Genere Voce Pronuncia',
    voice_female: 'Femminile',
    voice_male: 'Maschile',
    save_settings: 'Salva Preferenze',
    saving: 'Salvataggio…',
    settings_saved: 'Impostazioni salvate con successo!',

    // Share & Modals
    share_postcard: 'Condividi Cartolina Parola',
    download_png: 'Scarica PNG',
    copy_link: 'Copia Link',
    link_copied: 'Link Copiato',

    // Common / Auth
    loading: 'Caricamento…',
    error: 'Errore',
    close: 'Chiudi',
    back: 'Indietro',
  },
};

export function getTranslation(key: string, langCode?: string | null): string {
  const code = (langCode || 'en').toLowerCase() as LanguageCode;
  const dict = TRANSLATIONS[code] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}

export function useTranslation() {
  const { user } = useAuth();
  const langCode = user?.native_language || 'en';

  const t = (key: string): string => {
    return getTranslation(key, langCode);
  };

  return { t, langCode };
}
