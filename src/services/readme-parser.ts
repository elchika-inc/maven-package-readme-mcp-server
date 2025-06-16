import { UsageExample } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class ReadmeParser {
  /**
   * Extract usage examples from README content
   */
  static extractUsageExamples(readmeContent: string, includeExamples: boolean = true): UsageExample[] {
    if (!includeExamples || !readmeContent) {
      return [];
    }

    const examples: UsageExample[] = [];

    try {
      // Split content into sections
      const sections = this.splitIntoSections(readmeContent);
      
      // Find sections that likely contain usage examples
      const usageSections = sections.filter(section => 
        this.isUsageSection(section.title)
      );

      for (const section of usageSections) {
        const sectionExamples = this.extractCodeBlocksFromSection(section);
        examples.push(...sectionExamples);
      }

      // Remove duplicates
      const uniqueExamples = this.removeDuplicateExamples(examples);
      
      logger.debug('Extracted usage examples', { 
        totalSections: sections.length,
        usageSections: usageSections.length,
        examples: uniqueExamples.length 
      });

      return uniqueExamples.slice(0, 10); // Limit to 10 examples
    } catch (error) {
      logger.error('Failed to extract usage examples', { error });
      return [];
    }
  }

  /**
   * Split README content into sections based on headers
   */
  private static splitIntoSections(content: string): Array<{ title: string; content: string; level: number }> {
    const lines = content.split('\n');
    const sections: Array<{ title: string; content: string; level: number }> = [];
    let currentSection: { title: string; content: string; level: number } | null = null;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        currentSection = { title, content: '', level };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    // Add the last section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Check if a section title indicates it contains usage examples
   */
  private static isUsageSection(title: string): boolean {
    const usageKeywords = [
      'usage', 'example', 'examples', 'getting started', 'quick start',
      'how to use', 'basic usage', 'tutorial', 'guide', 'documentation',
      'getting-started', 'quickstart', 'quick-start'
    ];

    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    return usageKeywords.some(keyword => normalizedTitle.includes(keyword));
  }

  /**
   * Extract code blocks from a section
   */
  private static extractCodeBlocksFromSection(section: { title: string; content: string }): UsageExample[] {
    const examples: UsageExample[] = [];
    const content = section.content;

    // Match fenced code blocks (```)
    const fencedCodeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = fencedCodeRegex.exec(content)) !== null) {
      const language = match[1] || this.detectLanguage(match[2]);
      const code = match[2].trim();

      if (code && this.isRelevantCode(code, language)) {
        examples.push({
          title: section.title,
          description: this.extractDescription(content, match.index),
          code,
          language,
        });
      }
    }

    // Match indented code blocks (4 spaces or tab)
    const indentedCodeRegex = /(?:^|\n)((?:    |\t).+(?:\n(?:    |\t).+)*)/g;
    while ((match = indentedCodeRegex.exec(content)) !== null) {
      const code = match[1].replace(/^(    |\t)/gm, '').trim();
      
      if (code && this.isRelevantCode(code, 'java')) {
        examples.push({
          title: section.title,
          description: this.extractDescription(content, match.index),
          code,
          language: this.detectLanguage(code),
        });
      }
    }

    return examples;
  }

  /**
   * Detect programming language from code content
   */
  private static detectLanguage(code: string): string {
    const cleanCode = code.trim().toLowerCase();

    // Maven/Gradle patterns
    if (cleanCode.includes('<dependency>') || cleanCode.includes('<groupid>')) {
      return 'xml';
    }
    if (cleanCode.includes('implementation') || cleanCode.includes('compile ') || cleanCode.includes('dependencies {')) {
      return 'gradle';
    }
    if (cleanCode.includes('libraryDependencies') || cleanCode.includes('sbt')) {
      return 'scala';
    }

    // Java patterns
    if (cleanCode.includes('public class') || cleanCode.includes('import java') || cleanCode.includes('public static void main')) {
      return 'java';
    }

    // Kotlin patterns
    if (cleanCode.includes('fun ') || cleanCode.includes('val ') || cleanCode.includes('import kotlin')) {
      return 'kotlin';
    }

    // Scala patterns
    if (cleanCode.includes('object ') || cleanCode.includes('def ') || cleanCode.includes('import scala')) {
      return 'scala';
    }

    // Groovy patterns
    if (cleanCode.includes('@groovy') || cleanCode.includes('def ') && cleanCode.includes('groovy')) {
      return 'groovy';
    }

    // XML patterns
    if (cleanCode.includes('<?xml') || (cleanCode.includes('<') && cleanCode.includes('>'))) {
      return 'xml';
    }

    // Shell/Bash patterns
    if (cleanCode.includes('mvn ') || cleanCode.includes('gradle ') || cleanCode.includes('#!/bin/bash')) {
      return 'bash';
    }

    // Default to Java for unrecognized code in Maven context
    return 'java';
  }

  /**
   * Check if the code is relevant (not just comments or trivial)
   */
  private static isRelevantCode(code: string, language: string): boolean {
    const cleanCode = code.trim();
    
    // Too short
    if (cleanCode.length < 10) {
      return false;
    }

    // Only comments
    if (language === 'java' || language === 'kotlin' || language === 'scala') {
      const codeWithoutComments = cleanCode
        .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
        .replace(/\/\/.*$/gm, '') // Line comments
        .trim();
      
      if (codeWithoutComments.length < 5) {
        return false;
      }
    }

    // XML only with whitespace or basic structure
    if (language === 'xml') {
      const xmlWithoutWhitespace = cleanCode.replace(/\s+/g, '');
      return xmlWithoutWhitespace.length > 20 && (
        cleanCode.includes('<dependency>') ||
        cleanCode.includes('<groupId>') ||
        cleanCode.includes('<artifactId>')
      );
    }

    return true;
  }

  /**
   * Extract description text before a code block
   */
  private static extractDescription(content: string, codeIndex: number): string | undefined {
    const beforeCode = content.substring(0, codeIndex);
    const lines = beforeCode.split('\n').reverse();
    
    const descriptionLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (!trimmed) {
        if (descriptionLines.length > 0) break; // Stop at empty line if we have content
        continue;
      }
      
      if (trimmed.startsWith('#')) break; // Stop at headers
      
      if (trimmed.length > 5 && !trimmed.startsWith('```')) {
        descriptionLines.unshift(trimmed);
        if (descriptionLines.length >= 3) break; // Limit description length
      }
    }
    
    const description = descriptionLines.join(' ').trim();
    return description.length > 10 ? description : undefined;
  }

  /**
   * Remove duplicate examples based on code similarity
   */
  private static removeDuplicateExamples(examples: UsageExample[]): UsageExample[] {
    const unique: UsageExample[] = [];
    const seen = new Set<string>();

    for (const example of examples) {
      const normalized = this.normalizeCode(example.code);
      const key = `${example.language}:${normalized}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(example);
      }
    }

    return unique;
  }

  /**
   * Normalize code for comparison
   */
  private static normalizeCode(code: string): string {
    return code
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/['"]/g, '') // Remove quotes
      .trim()
      .substring(0, 100); // Take first 100 chars for comparison
  }

  /**
   * Clean README content by removing badges, excessive whitespace, etc.
   */
  static cleanReadmeContent(content: string): string {
    if (!content) {
      return '';
    }

    let cleaned = content;

    // Remove badge lines (common patterns)
    cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, ''); // Markdown images (often badges)
    cleaned = cleaned.replace(/\[!\[.*?\].*?\]/g, ''); // Badge links
    
    // Remove excessive whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Multiple newlines
    cleaned = cleaned.replace(/[ \t]+$/gm, ''); // Trailing whitespace
    
    // Remove HTML comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    return cleaned.trim();
  }

  /**
   * Extract title from README content
   */
  static extractTitle(content: string): string | undefined {
    if (!content) {
      return undefined;
    }

    // Look for the first # header
    const headerMatch = content.match(/^#\s+(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim();
    }

    // Look for title in HTML
    const htmlTitleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (htmlTitleMatch) {
      return htmlTitleMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    return undefined;
  }
}