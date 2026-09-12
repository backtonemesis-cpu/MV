import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(process.cwd(), 'src');
const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem',
]);
const COMPOSITE_ROLES_REQUIRING_EXPLICIT_NAME = new Set(['combobox', 'listbox']);
const NATIVE_INTERACTIVE = new Set(['button', 'input', 'select', 'textarea', 'summary']);

interface Finding {
  file: string;
  line: number;
  detail: string;
}

function walkTsx(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkTsx(full);
    if (!entry.isFile() || !entry.name.endsWith('.tsx') || entry.name.includes('.test.')) return [];
    return [full];
  });
}

function tagName(node: ts.JsxOpeningLikeElement): string {
  return node.tagName.getText();
}

function attr(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name
  );
}

function staticAttrValue(node: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const attribute = attr(node, name);
  if (!attribute?.initializer) return attribute ? '' : undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression &&
    (ts.isStringLiteral(attribute.initializer.expression) ||
      ts.isNoSubstitutionTemplateLiteral(attribute.initializer.expression) ||
      ts.isNumericLiteral(attribute.initializer.expression))
  ) {
    return attribute.initializer.expression.text;
  }
  return undefined;
}

function attrIdentityKey(node: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const attribute = attr(node, name);
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return `static:${attribute.initializer.text}`;
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return `expression:${attribute.initializer.expression.getText()}`;
  }
  return `initializer:${attribute.initializer.getText()}`;
}

function hasSpreadAttributes(node: ts.JsxOpeningLikeElement): boolean {
  return node.attributes.properties.some((property) => ts.isJsxSpreadAttribute(property));
}

function hasNamingAttribute(node: ts.JsxOpeningLikeElement): boolean {
  return Boolean(attr(node, 'aria-label') || attr(node, 'aria-labelledby') || attr(node, 'title'));
}

function meaningfulExpression(expression: ts.Expression): boolean {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression) ||
    ts.isTemplateExpression(expression) ||
    ts.isCallExpression(expression) ||
    ts.isPropertyAccessExpression(expression) ||
    ts.isElementAccessExpression(expression)
  ) {
    return true;
  }
  if (ts.isIdentifier(expression)) {
    return !['undefined', 'null', 'true', 'false'].includes(expression.text);
  }
  if (ts.isConditionalExpression(expression)) {
    return meaningfulExpression(expression.whenTrue) || meaningfulExpression(expression.whenFalse);
  }
  if (ts.isBinaryExpression(expression)) {
    return meaningfulExpression(expression.left) || meaningfulExpression(expression.right);
  }
  if (ts.isParenthesizedExpression(expression)) return meaningfulExpression(expression.expression);
  if (ts.isJsxElement(expression)) return hasMeaningfulChildren(expression);
  if (ts.isJsxFragment(expression)) return expression.children.some(meaningfulChild);
  if (ts.isJsxSelfClosingElement(expression)) return false;
  return true;
}

function meaningfulChild(child: ts.JsxChild): boolean {
  if (ts.isJsxText(child)) return child.getText().trim().length > 0;
  if (ts.isJsxExpression(child)) {
    return Boolean(child.expression && meaningfulExpression(child.expression));
  }
  if (ts.isJsxElement(child)) return hasMeaningfulChildren(child);
  return false;
}

function hasMeaningfulChildren(node: ts.JsxElement): boolean {
  return node.children.some(meaningfulChild);
}

function ancestorLabel(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxElement(current) && tagName(current.openingElement) === 'label') return true;
    current = current.parent;
  }
  return false;
}

function hasAssociatedLabel(
  node: ts.JsxOpeningLikeElement,
  labelledIds: Set<string>
): boolean {
  if (ancestorLabel(node)) return true;
  const idKey = attrIdentityKey(node, 'id');
  return Boolean(idKey && labelledIds.has(idKey));
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function elementHasText(node: ts.JsxOpeningLikeElement): boolean {
  return ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)
    ? hasMeaningfulChildren(node.parent)
    : false;
}

function inputType(node: ts.JsxOpeningLikeElement): string {
  return staticAttrValue(node, 'type')?.toLowerCase() ?? 'text';
}

function hasAccessibleName(
  node: ts.JsxOpeningLikeElement,
  labelledIds: Set<string>
): boolean {
  const tag = tagName(node);
  if (hasNamingAttribute(node)) return true;

  // A native primitive that spreads caller props is indeterminate at this source
  // location rather than definitely unnamed. Call-site contracts audit the supplied
  // aria/id props separately (for example the shared MoneyInput gate).
  if (hasSpreadAttributes(node)) return true;

  if (tag === 'button' || tag === 'summary' || tag === 'a') {
    return elementHasText(node);
  }

  if (tag === 'input') {
    const type = inputType(node);
    if (type === 'hidden') return true;
    if (['submit', 'reset', 'button'].includes(type)) {
      return Boolean(staticAttrValue(node, 'value'));
    }
    return hasAssociatedLabel(node, labelledIds);
  }

  if (tag === 'select' || tag === 'textarea') {
    return hasAssociatedLabel(node, labelledIds);
  }

  const role = staticAttrValue(node, 'role');
  if (role && COMPOSITE_ROLES_REQUIRING_EXPLICIT_NAME.has(role)) return false;
  if (role && INTERACTIVE_ROLES.has(role)) return elementHasText(node);
  return true;
}

function tabIndexValue(node: ts.JsxOpeningLikeElement): number | undefined {
  const attribute = attr(node, 'tabIndex');
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) {
    const value = Number(attribute.initializer.text);
    return Number.isFinite(value) ? value : undefined;
  }
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    const expression = attribute.initializer.expression;
    if (ts.isNumericLiteral(expression)) return Number(expression.text);
    if (ts.isPrefixUnaryExpression(expression) && ts.isNumericLiteral(expression.operand)) {
      const value = Number(expression.operand.text);
      return expression.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
  }
  return undefined;
}

function isSemanticallyInteractive(node: ts.JsxOpeningLikeElement): boolean {
  const tag = tagName(node);
  if (NATIVE_INTERACTIVE.has(tag)) return true;
  if (tag === 'a' && attr(node, 'href')) return true;
  const role = staticAttrValue(node, 'role');
  return Boolean(role && INTERACTIVE_ROLES.has(role));
}

function auditFile(file: string): Finding[] {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const labelledIds = new Set<string>();
  const findings: Finding[] = [];

  const collectLabels = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && tagName(node) === 'label') {
      const htmlForKey = attrIdentityKey(node, 'htmlFor');
      if (htmlForKey) labelledIds.add(htmlForKey);
    }
    ts.forEachChild(node, collectLabels);
  };
  collectLabels(sourceFile);

  const inspect = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      const role = staticAttrValue(node, 'role');
      const isNativeControl = ['button', 'input', 'select', 'textarea'].includes(tag);
      const isNamedInteractiveRole = Boolean(role && INTERACTIVE_ROLES.has(role));
      const isLink = tag === 'a' && Boolean(attr(node, 'href'));

      if ((isNativeControl || isNamedInteractiveRole || isLink) && !hasAccessibleName(node, labelledIds)) {
        findings.push({
          file: path.relative(SRC, file),
          line: lineOf(sourceFile, node),
          detail: `${tag}${role ? ` role=${role}` : ''} has no definite accessible name`,
        });
      }

      const tabIndex = tabIndexValue(node);
      if (tabIndex !== undefined && tabIndex >= 0 && !isSemanticallyInteractive(node)) {
        findings.push({
          file: path.relative(SRC, file),
          line: lineOf(sourceFile, node),
          detail: `${tag} enters forward tab order without native interactive semantics or an interactive role`,
        });
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(sourceFile);
  return findings;
}

const files = walkTsx(SRC);
const findings = files.flatMap(auditFile);

describe('global reachable-control source inventory', () => {
  it('audits all production TSX rather than a hand-written component shortlist', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((file) => file.endsWith('App.tsx'))).toBe(true);
    expect(files.some((file) => file.endsWith('TransactionModal.tsx'))).toBe(true);
  });

  it('has no definite unnamed native controls, links, or interactive-role widgets', () => {
    expect(findings.filter((finding) => finding.detail.includes('accessible name'))).toEqual([]);
  });

  it('does not place non-interactive elements in the forward tab order', () => {
    expect(findings.filter((finding) => finding.detail.includes('forward tab order'))).toEqual([]);
  });
});
