'use client';

export function LandingFeatures() {
  const features = [
    {
      icon: '🎵',
      title: 'Melodic Recall',
      subtitle: 'Feature 1',
      description: 'Associative learning binds definitions to music. Hear a word in context and never forget it.',
    },
    {
      icon: '🗣️',
      title: 'Rhythmic Pronunciation',
      subtitle: '',
      description: 'Perfect pronunciation with native speaker tracks. Learn how words really sound in context.',
    },
    {
      icon: '💜',
      title: 'Personalized Playlists',
      subtitle: '',
      description: 'AI adapts to your level and musical tastes. Every word is chosen specifically for you.',
    },
  ];

  return (
    <section id="features" className="landing-features">
      <div className="landing-features-inner">
        <h2 className="landing-section-title">Why Harmonix?</h2>
        <div className="landing-features-grid">
          {features.map((feature) => (
            <div key={feature.title} className="landing-feature-card">
              <div className="landing-feature-icon-row">
                <span className="landing-feature-icon">{feature.icon}</span>
              </div>
              <h3 className="landing-feature-title">
                {feature.subtitle && <span className="landing-feature-subtitle">{feature.subtitle}: </span>}
                {feature.title}
              </h3>
              <p className="landing-feature-desc">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
