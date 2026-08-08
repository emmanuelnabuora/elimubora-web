const title = 'Developer Platform';

export default function Page() {
  return (
    <section style={{ background: '#fff', border: '1px solid #e6e8f2', borderRadius: 18, padding: 28 }}>
      <h1 style={{ margin: 0, color: '#1f2437', fontSize: 28 }}>{title}</h1>
      <p style={{ color: '#6b7285', marginTop: 8 }}>
        This workspace is now routed and protected for platform administrators. Connect the corresponding NestJS platform API before enabling privileged mutations.
      </p>
    </section>
  );
}
