import { useState, useEffect } from 'react';
import { X, Plus, Save, Trash2, User, Users, Wand2, Sparkles } from 'lucide-react';

interface CharacterBuilderProps {
  onClose: () => void;
  bookId: string;
}

interface Character {
  character_id?: string;
  name: string;
  role: string;
  archetype: string;
  description: string;
  appearance: string;
  personality: string;
  background: string;
  motivation: string;
  goal: string;
  conflict: string;
  arc: string;
  relationships: { [key: string]: string };
  traits: { strengths: string[]; weaknesses: string[]; quirks: string[] };
  speech_patterns: string;
  catchphrases: string[];
  introduction_page: number | null;
  importance_level: number;
}

const EMPTY_CHARACTER: Character = {
  name: '',
  role: 'protagonist',
  archetype: 'hero',
  description: '',
  appearance: '',
  personality: '',
  background: '',
  motivation: '',
  goal: '',
  conflict: '',
  arc: '',
  relationships: {},
  traits: { strengths: [], weaknesses: [], quirks: [] },
  speech_patterns: '',
  catchphrases: [],
  introduction_page: null,
  importance_level: 5
};

const ROLES = [
  { value: 'protagonist', label: 'Protagonist', icon: '🌟' },
  { value: 'antagonist', label: 'Antagonist', icon: '⚔️' },
  { value: 'supporting', label: 'Supporting', icon: '👥' },
  { value: 'minor', label: 'Minor', icon: '👤' }
];

const ARCHETYPES = [
  { value: 'hero', label: 'Hero' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'trickster', label: 'Trickster' },
  { value: 'ally', label: 'Ally' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'herald', label: 'Herald' },
  { value: 'shapeshifter', label: 'Shapeshifter' }
];

export default function CharacterBuilder({ onClose, bookId }: CharacterBuilderProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTrait, setNewTrait] = useState({ category: 'strengths', value: '' });
  const [newCatchphrase, setNewCatchphrase] = useState('');

  const selectedCharacter = selectedIndex !== null ? characters[selectedIndex] : null;

  useEffect(() => {
    loadCharacters();
  }, [bookId]);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/books/${bookId}/characters`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCharacters(data.characters || []);
      }
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCharacter = () => {
    setCharacters([...characters, { ...EMPTY_CHARACTER }]);
    setSelectedIndex(characters.length);
  };

  const handleSaveCharacter = async () => {
    if (!selectedCharacter) return;

    setSaving(true);
    try {
      const isNew = !selectedCharacter.character_id;
      const url = isNew
        ? `/api/books/${bookId}/characters`
        : `/api/characters/${selectedCharacter.character_id}`;

      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        },
        body: JSON.stringify(selectedCharacter)
      });

      if (response.ok) {
        const data = await response.json();

        // If new character, update with returned character_id
        if (isNew && data.character) {
          const updatedCharacters = [...characters];
          updatedCharacters[selectedIndex!] = {
            ...selectedCharacter,
            character_id: data.character.character_id
          };
          setCharacters(updatedCharacters);
        }

        alert('Character saved successfully!');
      } else {
        throw new Error('Failed to save character');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save character');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCharacter = async () => {
    if (!selectedCharacter || !selectedCharacter.character_id) return;

    if (!confirm(`Delete ${selectedCharacter.name}?`)) return;

    try {
      const response = await fetch(`/api/characters/${selectedCharacter.character_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        }
      });

      if (response.ok) {
        const newCharacters = characters.filter((_, i) => i !== selectedIndex);
        setCharacters(newCharacters);
        setSelectedIndex(newCharacters.length > 0 ? 0 : null);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete character');
    }
  };

  const updateCharacter = (field: keyof Character, value: any) => {
    if (selectedIndex === null) return;

    const updated = [...characters];
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      [field]: value
    };
    setCharacters(updated);
  };

  const addTrait = () => {
    if (!newTrait.value.trim() || selectedIndex === null) return;

    const updated = [...characters];
    const category = newTrait.category as 'strengths' | 'weaknesses' | 'quirks';

    updated[selectedIndex] = {
      ...updated[selectedIndex],
      traits: {
        ...updated[selectedIndex].traits,
        [category]: [...(updated[selectedIndex].traits[category] || []), newTrait.value.trim()]
      }
    };

    setCharacters(updated);
    setNewTrait({ ...newTrait, value: '' });
  };

  const removeTrait = (category: 'strengths' | 'weaknesses' | 'quirks', index: number) => {
    if (selectedIndex === null) return;

    const updated = [...characters];
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      traits: {
        ...updated[selectedIndex].traits,
        [category]: updated[selectedIndex].traits[category].filter((_, i) => i !== index)
      }
    };
    setCharacters(updated);
  };

  const addCatchphrase = () => {
    if (!newCatchphrase.trim() || selectedIndex === null) return;

    const updated = [...characters];
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      catchphrases: [...updated[selectedIndex].catchphrases, newCatchphrase.trim()]
    };

    setCharacters(updated);
    setNewCatchphrase('');
  };

  const removeCatchphrase = (index: number) => {
    if (selectedIndex === null) return;

    const updated = [...characters];
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      catchphrases: updated[selectedIndex].catchphrases.filter((_, i) => i !== index)
    };
    setCharacters(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="glass-morphism rounded-2xl max-w-7xl w-full p-4 sm:p-6 md:p-8 animate-slide-up my-auto max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <Users className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Character Builder</h2>
              <p className="text-sm text-gray-400 mt-1">Create deep, memorable characters for your story</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
          {/* Character List */}
          <div className="lg:col-span-1 space-y-3 overflow-y-auto">
            <button
              onClick={handleCreateCharacter}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Character
            </button>

            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : characters.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No characters yet</p>
              </div>
            ) : (
              characters.map((char, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedIndex(index)}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                    selectedIndex === index
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">
                      {ROLES.find(r => r.value === char.role)?.icon || '👤'}
                    </span>
                    <span className="font-semibold truncate">
                      {char.name || 'Unnamed Character'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {ROLES.find(r => r.value === char.role)?.label || 'Character'}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Character Details */}
          {selectedCharacter ? (
            <div className="lg:col-span-3 overflow-y-auto space-y-6">
              {/* Basic Info */}
              <div className="glass-morphism rounded-xl p-6 bg-white/5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand-400" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Name *</label>
                    <input
                      type="text"
                      value={selectedCharacter.name}
                      onChange={(e) => updateCharacter('name', e.target.value)}
                      className="input-field"
                      placeholder="Character name..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Role</label>
                    <select
                      value={selectedCharacter.role}
                      onChange={(e) => updateCharacter('role', e.target.value)}
                      className="input-field"
                    >
                      {ROLES.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.icon} {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Archetype</label>
                    <select
                      value={selectedCharacter.archetype}
                      onChange={(e) => updateCharacter('archetype', e.target.value)}
                      className="input-field"
                    >
                      {ARCHETYPES.map(arch => (
                        <option key={arch.value} value={arch.value}>{arch.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Importance (1-10)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={selectedCharacter.importance_level}
                      onChange={(e) => updateCharacter('importance_level', parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                    <div className="text-center text-sm text-brand-400 mt-1">
                      {selectedCharacter.importance_level}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Description
                  </label>
                  <textarea
                    value={selectedCharacter.description}
                    onChange={(e) => updateCharacter('description', e.target.value)}
                    className="input-field min-h-20 resize-none"
                    placeholder="Brief character summary..."
                  />
                </div>
              </div>

              {/* Physical & Personality */}
              <div className="glass-morphism rounded-xl p-6 bg-white/5">
                <h3 className="text-lg font-semibold mb-4">Physical & Personality</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Appearance
                    </label>
                    <textarea
                      value={selectedCharacter.appearance}
                      onChange={(e) => updateCharacter('appearance', e.target.value)}
                      className="input-field min-h-20 resize-none"
                      placeholder="Physical description, clothing, distinguishing features..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Personality
                    </label>
                    <textarea
                      value={selectedCharacter.personality}
                      onChange={(e) => updateCharacter('personality', e.target.value)}
                      className="input-field min-h-20 resize-none"
                      placeholder="Temperament, behavior, habits..."
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Background
                  </label>
                  <textarea
                    value={selectedCharacter.background}
                    onChange={(e) => updateCharacter('background', e.target.value)}
                    className="input-field min-h-20 resize-none"
                    placeholder="History, family, upbringing, past experiences..."
                  />
                </div>
              </div>

              {/* Character Arc */}
              <div className="glass-morphism rounded-xl p-6 bg-white/5">
                <h3 className="text-lg font-semibold mb-4">Character Arc</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Motivation
                    </label>
                    <textarea
                      value={selectedCharacter.motivation}
                      onChange={(e) => updateCharacter('motivation', e.target.value)}
                      className="input-field min-h-16 resize-none"
                      placeholder="What drives this character? What do they want most?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Goal
                    </label>
                    <textarea
                      value={selectedCharacter.goal}
                      onChange={(e) => updateCharacter('goal', e.target.value)}
                      className="input-field min-h-16 resize-none"
                      placeholder="What are they trying to achieve?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Conflict
                    </label>
                    <textarea
                      value={selectedCharacter.conflict}
                      onChange={(e) => updateCharacter('conflict', e.target.value)}
                      className="input-field min-h-16 resize-none"
                      placeholder="What's standing in their way?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">
                      Character Arc
                    </label>
                    <textarea
                      value={selectedCharacter.arc}
                      onChange={(e) => updateCharacter('arc', e.target.value)}
                      className="input-field min-h-16 resize-none"
                      placeholder="How will this character change throughout the story?"
                    />
                  </div>
                </div>
              </div>

              {/* Traits */}
              <div className="glass-morphism rounded-xl p-6 bg-white/5">
                <h3 className="text-lg font-semibold mb-4">Character Traits</h3>

                {(['strengths', 'weaknesses', 'quirks'] as const).map(category => (
                  <div key={category} className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-gray-300 capitalize">
                      {category}
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newTrait.category === category ? newTrait.value : ''}
                        onChange={(e) => setNewTrait({ category, value: e.target.value })}
                        onKeyPress={(e) => e.key === 'Enter' && newTrait.category === category && addTrait()}
                        className="input-field flex-1"
                        placeholder={`Add ${category.slice(0, -1)}...`}
                      />
                      <button
                        onClick={() => {
                          setNewTrait({ category, value: newTrait.value });
                          addTrait();
                        }}
                        className="btn-secondary px-4"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCharacter.traits[category]?.map((trait, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-white/10 rounded-full text-sm flex items-center gap-2"
                        >
                          {trait}
                          <button
                            onClick={() => removeTrait(category, i)}
                            className="hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Voice & Dialogue */}
              <div className="glass-morphism rounded-xl p-6 bg-white/5">
                <h3 className="text-lg font-semibold mb-4">Voice & Dialogue</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Speech Patterns
                  </label>
                  <textarea
                    value={selectedCharacter.speech_patterns}
                    onChange={(e) => updateCharacter('speech_patterns', e.target.value)}
                    className="input-field min-h-16 resize-none"
                    placeholder="How does this character speak? Formal, casual, accent, catchphrases..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    Catchphrases
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newCatchphrase}
                      onChange={(e) => setNewCatchphrase(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCatchphrase()}
                      className="input-field flex-1"
                      placeholder="Add catchphrase..."
                    />
                    <button onClick={addCatchphrase} className="btn-secondary px-4">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedCharacter.catchphrases?.map((phrase, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 bg-white/10 rounded-lg text-sm flex items-center justify-between"
                      >
                        <span>"{phrase}"</span>
                        <button
                          onClick={() => removeCatchphrase(i)}
                          className="hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pb-6">
                {selectedCharacter.character_id && (
                  <button
                    onClick={handleDeleteCharacter}
                    className="btn-secondary text-red-400 border-red-500/20 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleSaveCharacter}
                  disabled={saving || !selectedCharacter.name.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" />
                      Save Character
                    </span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-3 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a character or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
