export default function SectionHeader({ title, description }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-indusia-text">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-indusia-textMuted mt-2">
          {description}
        </p>
      )}
    </div>
  );
}
