import { describe, it, expect } from 'vitest';
import { ReadmeParser } from '../../src/services/readme-parser.js';

describe('ReadmeParser', () => {
  describe('extractUsageExamples', () => {
    it('should extract fenced code blocks', () => {
      const readmeContent = `
# Usage

Here's how to use this library:

\`\`\`java
public class Example {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
\`\`\`

\`\`\`xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>my-library</artifactId>
    <version>1.0.0</version>
</dependency>
\`\`\`
      `;

      const examples = ReadmeParser.extractUsageExamples(readmeContent, true);
      
      expect(examples).toHaveLength(2);
      expect(examples[0].language).toBe('java');
      expect(examples[0].code).toContain('public class Example');
      expect(examples[1].language).toBe('xml');
      expect(examples[1].code).toContain('<dependency>');
    });

    it('should extract indented code blocks', () => {
      const readmeContent = `
# Usage

Here's a simple example:

    public class Example {
        public void hello() {
            System.out.println("Hello");
        }
    }
      `;

      const examples = ReadmeParser.extractUsageExamples(readmeContent, true);
      
      expect(examples).toHaveLength(1);
      expect(examples[0].language).toBe('java');
      expect(examples[0].code).toContain('public class Example');
    });

    it('should return empty array when includeExamples is false', () => {
      const readmeContent = `
# Usage
\`\`\`java
public class Example {}
\`\`\`
      `;

      const examples = ReadmeParser.extractUsageExamples(readmeContent, false);
      expect(examples).toHaveLength(0);
    });

    it('should filter out irrelevant code', () => {
      const readmeContent = `
# Usage

\`\`\`java
// Just a comment
\`\`\`

\`\`\`java
public class RealExample {
    public void doSomething() {
        System.out.println("Real code");
    }
}
\`\`\`
      `;

      const examples = ReadmeParser.extractUsageExamples(readmeContent, true);
      
      expect(examples).toHaveLength(1);
      expect(examples[0].code).toContain('public class RealExample');
    });

    it('should detect usage sections', () => {
      const readmeContent = `
# Installation

Install the library.

# Getting Started

\`\`\`java
Example code here
\`\`\`

# API Reference

No examples here.

# Examples

\`\`\`java
More examples here
\`\`\`
      `;

      const examples = ReadmeParser.extractUsageExamples(readmeContent, true);
      
      expect(examples).toHaveLength(2);
      expect(examples[0].title).toBe('Getting Started');
      expect(examples[1].title).toBe('Examples');
    });

    it('should remove duplicate examples', () => {
      const readmeContent = `
# Usage

\`\`\`java
public class Example {
    public void hello() {
        System.out.println("Hello");
    }
}
\`\`\`

# Examples

\`\`\`java
public class Example {
    public void hello() {
        System.out.println("Hello");
    }
}
\`\`\`
      `;

      const examples = ReadmeParser.extractUsageExamples(readmeContent, true);
      
      expect(examples).toHaveLength(1);
    });

    it('should limit to 10 examples', () => {
      let readmeContent = '# Usage\n\n';
      for (let i = 0; i < 15; i++) {
        readmeContent += `\`\`\`java\npublic class Example${i} {}\n\`\`\`\n\n`;
      }

      const examples = ReadmeParser.extractUsageExamples(readmeContent, true);
      
      expect(examples).toHaveLength(10);
    });
  });

  describe('detectLanguage', () => {
    it('should detect Java', () => {
      const code = `
public class Example {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
      `;
      
      const language = ReadmeParser['detectLanguage'](code);
      expect(language).toBe('java');
    });

    it('should detect XML', () => {
      const code = `
<dependency>
    <groupId>com.example</groupId>
    <artifactId>my-library</artifactId>
</dependency>
      `;
      
      const language = ReadmeParser['detectLanguage'](code);
      expect(language).toBe('xml');
    });

    it('should detect Gradle', () => {
      const code = `
dependencies {
    implementation 'com.example:my-library:1.0.0'
}
      `;
      
      const language = ReadmeParser['detectLanguage'](code);
      expect(language).toBe('gradle');
    });

    it('should detect Kotlin', () => {
      const code = `
fun main() {
    val message = "Hello World"
    println(message)
}
      `;
      
      const language = ReadmeParser['detectLanguage'](code);
      expect(language).toBe('kotlin');
    });

    it('should detect Scala', () => {
      const code = `
object Example {
    def main(args: Array[String]): Unit = {
        println("Hello")
    }
}
      `;
      
      const language = ReadmeParser['detectLanguage'](code);
      expect(language).toBe('scala');
    });

    it('should detect bash', () => {
      const code = `
mvn clean install
gradle build
      `;
      
      const language = ReadmeParser['detectLanguage'](code);
      expect(language).toBe('bash');
    });

    it('should default to java', () => {
      const code = 'some unknown code';
      
      const language = ReadmeParser['detectLanguage'](code);
      expect(language).toBe('java');
    });
  });

  describe('cleanReadmeContent', () => {
    it('should remove badges', () => {
      const content = `
# My Library

![Build Status](https://img.shields.io/badge/build-passing-green)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://example.com)

This is a great library.
      `;

      const cleaned = ReadmeParser.cleanReadmeContent(content);
      
      expect(cleaned).not.toContain('![Build Status]');
      expect(cleaned).not.toContain('[![Coverage]');
      expect(cleaned).toContain('This is a great library');
    });

    it('should remove excessive whitespace', () => {
      const content = `
# Title



This has too much whitespace.    


More content here.
      `;

      const cleaned = ReadmeParser.cleanReadmeContent(content);
      
      expect(cleaned).not.toContain('\n\n\n');
      expect(cleaned).not.toContain('    \n');
    });

    it('should remove HTML comments', () => {
      const content = `
# Title

<!-- This is a comment -->
This is content.
<!-- Another comment -->
      `;

      const cleaned = ReadmeParser.cleanReadmeContent(content);
      
      expect(cleaned).not.toContain('<!-- This is a comment -->');
      expect(cleaned).toContain('This is content.');
    });

    it('should handle empty content', () => {
      const cleaned = ReadmeParser.cleanReadmeContent('');
      expect(cleaned).toBe('');
    });
  });

  describe('extractTitle', () => {
    it('should extract title from markdown header', () => {
      const content = `
# My Amazing Library

This is the description.
      `;

      const title = ReadmeParser.extractTitle(content);
      expect(title).toBe('My Amazing Library');
    });

    it('should extract title from HTML', () => {
      const content = `
<h1>My Amazing Library</h1>

<p>This is the description.</p>
      `;

      const title = ReadmeParser.extractTitle(content);
      expect(title).toBe('My Amazing Library');
    });

    it('should handle HTML with attributes', () => {
      const content = `
<h1 class="title" id="main-title">My <em>Amazing</em> Library</h1>
      `;

      const title = ReadmeParser.extractTitle(content);
      expect(title).toBe('My Amazing Library');
    });

    it('should return undefined for no title', () => {
      const content = `
This is just content without a title.
      `;

      const title = ReadmeParser.extractTitle(content);
      expect(title).toBeUndefined();
    });

    it('should handle empty content', () => {
      const title = ReadmeParser.extractTitle('');
      expect(title).toBeUndefined();
    });
  });

  describe('isUsageSection', () => {
    it('should identify usage sections', () => {
      const usageTitles = [
        'Usage',
        'Examples',
        'Getting Started',
        'Quick Start',
        'How to Use',
        'Basic Usage',
        'Tutorial',
        'getting-started',
        'quickstart'
      ];

      usageTitles.forEach(title => {
        const isUsage = ReadmeParser['isUsageSection'](title);
        expect(isUsage).toBe(true);
      });
    });

    it('should not identify non-usage sections', () => {
      const nonUsageTitles = [
        'Installation',
        'API Reference',
        'Contributing',
        'License',
        'Changelog'
      ];

      nonUsageTitles.forEach(title => {
        const isUsage = ReadmeParser['isUsageSection'](title);
        expect(isUsage).toBe(false);
      });
    });
  });

  describe('isRelevantCode', () => {
    it('should accept relevant Java code', () => {
      const code = `
public class Example {
    public void doSomething() {
        System.out.println("Hello");
    }
}
      `;

      const isRelevant = ReadmeParser['isRelevantCode'](code, 'java');
      expect(isRelevant).toBe(true);
    });

    it('should reject very short code', () => {
      const code = 'x = 1';

      const isRelevant = ReadmeParser['isRelevantCode'](code, 'java');
      expect(isRelevant).toBe(false);
    });

    it('should reject comment-only code', () => {
      const code = `
// This is just a comment
/* Another comment */
      `;

      const isRelevant = ReadmeParser['isRelevantCode'](code, 'java');
      expect(isRelevant).toBe(false);
    });

    it('should accept relevant XML', () => {
      const code = `
<dependency>
    <groupId>com.example</groupId>
    <artifactId>my-library</artifactId>
    <version>1.0.0</version>
</dependency>
      `;

      const isRelevant = ReadmeParser['isRelevantCode'](code, 'xml');
      expect(isRelevant).toBe(true);
    });

    it('should reject trivial XML', () => {
      const code = '<xml></xml>';

      const isRelevant = ReadmeParser['isRelevantCode'](code, 'xml');
      expect(isRelevant).toBe(false);
    });
  });
});