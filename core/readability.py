"""
Readability analysis utilities for book content
"""
import re
import math
from typing import Dict


def count_syllables(word: str) -> int:
    """
    Estimate syllable count in a word
    Uses simplified algorithm (not perfect but good enough)
    """
    word = word.lower().strip()
    if len(word) <= 3:
        return 1

    # Remove common suffixes that don't add syllables
    word = re.sub(r'(es|ed|e)$', '', word)

    # Count vowel groups
    vowels = 'aeiouy'
    syllable_count = 0
    previous_was_vowel = False

    for char in word:
        is_vowel = char in vowels
        if is_vowel and not previous_was_vowel:
            syllable_count += 1
        previous_was_vowel = is_vowel

    # Ensure at least 1 syllable
    return max(1, syllable_count)


def calculate_flesch_reading_ease(text: str) -> Dict:
    """
    Calculate Flesch Reading Ease score
    206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)

    Score interpretation:
    90-100: Very Easy (5th grade)
    80-89: Easy (6th grade)
    70-79: Fairly Easy (7th grade)
    60-69: Standard (8th-9th grade)
    50-59: Fairly Difficult (10th-12th grade)
    30-49: Difficult (College)
    0-29: Very Difficult (College graduate)
    """
    # Clean text
    text = re.sub(r'[#*_`]', '', text)  # Remove markdown

    # Count sentences (approximate)
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    total_sentences = len(sentences)

    if total_sentences == 0:
        return {
            'score': 0,
            'grade_level': 'N/A',
            'difficulty': 'No content'
        }

    # Count words
    words = re.findall(r'\b[a-zA-Z]+\b', text)
    total_words = len(words)

    if total_words == 0:
        return {
            'score': 0,
            'grade_level': 'N/A',
            'difficulty': 'No content'
        }

    # Count syllables
    total_syllables = sum(count_syllables(word) for word in words)

    # Calculate score
    score = 206.835 - 1.015 * (total_words / total_sentences) - 84.6 * (total_syllables / total_words)
    score = max(0, min(100, score))  # Clamp between 0-100

    # Interpret score
    if score >= 90:
        grade_level = '5th grade'
        difficulty = 'Very Easy'
    elif score >= 80:
        grade_level = '6th grade'
        difficulty = 'Easy'
    elif score >= 70:
        grade_level = '7th grade'
        difficulty = 'Fairly Easy'
    elif score >= 60:
        grade_level = '8th-9th grade'
        difficulty = 'Standard'
    elif score >= 50:
        grade_level = '10th-12th grade'
        difficulty = 'Fairly Difficult'
    elif score >= 30:
        grade_level = 'College'
        difficulty = 'Difficult'
    else:
        grade_level = 'College graduate'
        difficulty = 'Very Difficult'

    return {
        'score': round(score, 1),
        'grade_level': grade_level,
        'difficulty': difficulty,
        'words': total_words,
        'sentences': total_sentences,
        'syllables': total_syllables
    }


def calculate_gunning_fog(text: str) -> Dict:
    """
    Calculate Gunning Fog Index
    0.4 * ((words / sentences) + 100 * (complex words / words))

    Complex words = 3+ syllables
    """
    text = re.sub(r'[#*_`]', '', text)

    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    total_sentences = len(sentences)

    if total_sentences == 0:
        return {'score': 0, 'grade_level': 'N/A'}

    words = re.findall(r'\b[a-zA-Z]+\b', text)
    total_words = len(words)

    if total_words == 0:
        return {'score': 0, 'grade_level': 'N/A'}

    # Count complex words (3+ syllables)
    complex_words = sum(1 for word in words if count_syllables(word) >= 3)

    # Calculate index
    score = 0.4 * ((total_words / total_sentences) + 100 * (complex_words / total_words))

    return {
        'score': round(score, 1),
        'grade_level': f'{int(score)}th grade' if score > 0 else 'N/A',
        'complex_words': complex_words,
        'complex_word_percentage': round(100 * complex_words / total_words, 1)
    }


def analyze_text_statistics(text: str) -> Dict:
    """
    Comprehensive text statistics
    """
    text_clean = re.sub(r'[#*_`]', '', text)

    # Words
    words = re.findall(r'\b[a-zA-Z]+\b', text_clean)
    total_words = len(words)

    # Sentences
    sentences = re.split(r'[.!?]+', text_clean)
    sentences = [s.strip() for s in sentences if s.strip()]
    total_sentences = len(sentences)

    # Paragraphs (separated by double newlines)
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    total_paragraphs = len(paragraphs)

    # Characters
    total_characters = len(text_clean.replace(' ', '').replace('\n', ''))

    # Average calculations
    avg_word_length = total_characters / total_words if total_words > 0 else 0
    avg_sentence_length = total_words / total_sentences if total_sentences > 0 else 0
    avg_paragraph_length = total_sentences / total_paragraphs if total_paragraphs > 0 else 0

    # Unique words (vocabulary richness)
    unique_words = len(set(word.lower() for word in words))
    vocabulary_richness = unique_words / total_words if total_words > 0 else 0

    return {
        'total_words': total_words,
        'total_sentences': total_sentences,
        'total_paragraphs': total_paragraphs,
        'total_characters': total_characters,
        'unique_words': unique_words,
        'vocabulary_richness': round(vocabulary_richness, 3),
        'avg_word_length': round(avg_word_length, 2),
        'avg_sentence_length': round(avg_sentence_length, 1),
        'avg_paragraph_length': round(avg_paragraph_length, 1)
    }


def generate_readability_report(text: str) -> Dict:
    """
    Generate complete readability report
    """
    flesch = calculate_flesch_reading_ease(text)
    fog = calculate_gunning_fog(text)
    stats = analyze_text_statistics(text)

    return {
        'readability': {
            'flesch_reading_ease': flesch,
            'gunning_fog_index': fog
        },
        'statistics': stats,
        'recommendations': _generate_recommendations(flesch, fog, stats)
    }


def _generate_recommendations(flesch: Dict, fog: Dict, stats: Dict) -> list:
    """Generate writing improvement recommendations"""
    recommendations = []

    # Check readability
    if flesch['score'] < 60:
        recommendations.append({
            'type': 'readability',
            'severity': 'high',
            'message': 'Text may be too complex. Consider shorter sentences and simpler words.',
            'target': f'Aim for Flesch score > 60 (currently {flesch["score"]})'
        })

    # Check sentence length
    if stats['avg_sentence_length'] > 25:
        recommendations.append({
            'type': 'sentence_length',
            'severity': 'medium',
            'message': 'Average sentence length is high. Break up long sentences.',
            'target': f'Aim for < 20 words/sentence (currently {stats["avg_sentence_length"]})'
        })

    # Check paragraph length
    if stats['avg_paragraph_length'] > 10:
        recommendations.append({
            'type': 'paragraph_length',
            'severity': 'low',
            'message': 'Paragraphs may be too long. Consider breaking them up for readability.',
            'target': f'Aim for 4-6 sentences/paragraph (currently {stats["avg_paragraph_length"]})'
        })

    # Check vocabulary richness
    if stats['vocabulary_richness'] < 0.4:
        recommendations.append({
            'type': 'vocabulary',
            'severity': 'low',
            'message': 'Vocabulary could be more varied. Try using synonyms.',
            'target': f'Aim for richness > 0.4 (currently {stats["vocabulary_richness"]})'
        })

    if not recommendations:
        recommendations.append({
            'type': 'success',
            'severity': 'none',
            'message': '✓ Text readability is excellent!',
            'target': 'Keep up the great work'
        })

    return recommendations
