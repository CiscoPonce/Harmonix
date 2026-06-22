'use client';

export function LandingTestimonials() {
  const testimonials = [
    { quote: 'Learned 100 new words in a month!', author: 'Alex R.' },
    { quote: 'The music context makes vocabulary stick!', author: 'Maria S.' },
    { quote: 'Best language app I\'ve ever used.', author: 'James T.' },
    { quote: 'I study Spanish while listening to Bad Bunny!', author: 'Sofia L.' },
    { quote: 'My streak is at 30 days and counting.', author: 'David K.' },
    { quote: 'Finally, an app that makes learning fun.', author: 'Emma W.' },
  ];

  return (
    <section id="testimonials" className="landing-testimonials">
      <div className="landing-testimonials-inner">
        <h2 className="landing-section-title">What Learners Say</h2>
        <div className="landing-testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={i} className="landing-testimonial-card">
              <p className="landing-testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
              <p className="landing-testimonial-author">— {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
