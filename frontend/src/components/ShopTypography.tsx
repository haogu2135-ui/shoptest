import { reportNonBlockingError } from '../utils/nonBlockingError';
import React from 'react';
import './ShopTypography.css';

export type ShopTypographyTextType = 'secondary' | 'success' | 'warning' | 'danger' | undefined;

type CommonTextProps = {
  type?: ShopTypographyTextType;
  strong?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  ellipsis?: boolean | { rows?: number; tooltip?: React.ReactNode; expandable?: boolean; symbol?: React.ReactNode };
  copyable?: boolean | { text?: string; tooltips?: boolean | [React.ReactNode, React.ReactNode]; onCopy?: () => void };
  code?: boolean;
  mark?: boolean;
  underline?: boolean;
  delete?: boolean;
  italic?: boolean;
};

export type ShopTypographyTextProps = CommonTextProps & Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>;

export type ShopTypographyTitleProps = CommonTextProps & {
  level?: 1 | 2 | 3 | 4 | 5;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, 'color'>;

export type ShopTypographyParagraphProps = CommonTextProps & Omit<React.HTMLAttributes<HTMLParagraphElement>, 'color'>;

export type ShopTypographyLinkProps = CommonTextProps & {
  href?: string;
  target?: string;
  rel?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'color' | 'type'>;

export type ShopTypographyProps = {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>;


const resolveEllipsis = (ellipsis?: boolean | { rows?: number; tooltip?: React.ReactNode }) => {
  if (!ellipsis) return { className: '', style: undefined as React.CSSProperties | undefined };
  if (ellipsis === true) {
    return { className: 'shop-typography-text--ellipsis ant-typography-ellipsis', style: undefined };
  }
  const rows = ellipsis.rows && ellipsis.rows > 1 ? ellipsis.rows : 1;
  if (rows <= 1) {
    return { className: 'shop-typography-text--ellipsis ant-typography-ellipsis', style: undefined };
  }
  return {
    className: 'shop-typography-text--ellipsisMultiline ant-typography-ellipsis',
    style: {
      display: '-webkit-box',
      WebkitLineClamp: rows,
      WebkitBoxOrient: 'vertical' as const,
      overflow: 'hidden',
    } as React.CSSProperties,
  };
};

const typeClass = (type?: ShopTypographyTextType) =>
  type ? `shop-typography-text--${type} ant-typography-${type}` : '';

const wrapDecorations = (
  content: React.ReactNode,
  opts: { strong?: boolean; code?: boolean; mark?: boolean; underline?: boolean; delete?: boolean; italic?: boolean },
) => {
  let node = content;
  if (opts.code) node = <code>{node}</code>;
  if (opts.mark) node = <mark>{node}</mark>;
  if (opts.underline) node = <u>{node}</u>;
  if (opts.delete) node = <del>{node}</del>;
  if (opts.italic) node = <i>{node}</i>;
  if (opts.strong) node = <strong>{node}</strong>;
  return node;
};

const ShopTypographyText: React.FC<ShopTypographyTextProps> = ({
  type,
  strong = false,
  className = '',
  style,
  children,
  ellipsis,
  copyable = false,
  code = false,
  mark = false,
  underline = false,
  delete: del = false,
  italic = false,
  ...rest
}) => {
  const [copied, setCopied] = React.useState(false);
  const copyConfig = copyable
    ? (typeof copyable === 'object' ? copyable : {})
    : null;

  const handleCopy = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!copyConfig) return;
    const text =
      copyConfig.text
      ?? (typeof children === 'string' || typeof children === 'number'
        ? String(children)
        : (event.currentTarget.parentElement?.innerText || ''));
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(text));
      }
      copyConfig.onCopy?.();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      reportNonBlockingError('ShopTypography.copyText', error);
    }
  };

  return (
    <span
      {...rest}
      className={[
        'shop-typography-text',
        'ant-typography',
        typeClass(type),
        strong ? 'shop-typography-text--strong' : '',
        ellipsis ? 'shop-typography-text--ellipsis ant-typography-ellipsis' : '',
        copyConfig ? 'shop-typography-text--copyable' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      {wrapDecorations(children, { strong, code, mark, underline, delete: del, italic })}
      {copyConfig ? (
        <button
          type="button"
          className="shop-typography-text__copy ant-typography-copy"
          aria-label={copied ? 'Copied' : 'Copy'}
          title={copied ? 'Copied' : 'Copy'}
          onClick={handleCopy}
        >
          {copied ? '✓' : '⧉'}
        </button>
      ) : null}
    </span>
  );
};

const ShopTypographyTitle: React.FC<ShopTypographyTitleProps> = ({
  level = 1,
  type,
  strong = false,
  className = '',
  style,
  children,
  ellipsis,
  code = false,
  mark = false,
  underline = false,
  delete: del = false,
  italic = false,
  ...rest
}) => {
  const Tag = (`h${Math.min(5, Math.max(1, level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5');
  return (
    <Tag
      {...rest}
      className={[
        'shop-typography-title',
        'ant-typography',
        `shop-typography-title--h${level}`,
        typeClass(type),
        strong ? 'shop-typography-text--strong' : '',
        ellipsis ? 'shop-typography-text--ellipsis ant-typography-ellipsis' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
    >
      {wrapDecorations(children, { strong, code, mark, underline, delete: del, italic })}
    </Tag>
  );
};

const ShopTypographyParagraph: React.FC<ShopTypographyParagraphProps> = ({
  type,
  strong = false,
  className = '',
  style,
  children,
  ellipsis,
  code = false,
  mark = false,
  underline = false,
  delete: del = false,
  italic = false,
  ...rest
}) => {
  const ell = resolveEllipsis(ellipsis);
  return (
    <p
      {...rest}
      className={[
        'shop-typography-paragraph',
        'ant-typography',
        typeClass(type),
        strong ? 'shop-typography-text--strong' : '',
        ell.className,
        className,
      ].filter(Boolean).join(' ')}
      style={{ ...ell.style, ...style }}
    >
      {wrapDecorations(children, { strong, code, mark, underline, delete: del, italic })}
    </p>
  );
};

const ShopTypographyLink: React.FC<ShopTypographyLinkProps> = ({
  type,
  strong = false,
  className = '',
  style,
  children,
  ellipsis,
  code = false,
  mark = false,
  underline = false,
  delete: del = false,
  italic = false,
  href,
  target,
  rel,
  ...rest
}) => (
  <a
    {...rest}
    href={href}
    target={target}
    rel={rel}
    className={[
      'shop-typography-link',
      'ant-typography',
      typeClass(type),
      strong ? 'shop-typography-text--strong' : '',
      ellipsis ? 'shop-typography-text--ellipsis ant-typography-ellipsis' : '',
      className,
    ].filter(Boolean).join(' ')}
    style={style}
  >
    {wrapDecorations(children, { strong, code, mark, underline, delete: del, italic })}
  </a>
);

const ShopTypographyRoot: React.FC<ShopTypographyProps> = ({
  className = '',
  style,
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={['shop-typography', 'ant-typography', className].filter(Boolean).join(' ')}
    style={style}
  >
    {children}
  </div>
);

type ShopTypographyComponent = React.FC<ShopTypographyProps> & {
  Text: typeof ShopTypographyText;
  Title: typeof ShopTypographyTitle;
  Paragraph: typeof ShopTypographyParagraph;
  Link: typeof ShopTypographyLink;
};

const ShopTypography = ShopTypographyRoot as ShopTypographyComponent;
ShopTypography.Text = ShopTypographyText;
ShopTypography.Title = ShopTypographyTitle;
ShopTypography.Paragraph = ShopTypographyParagraph;
ShopTypography.Link = ShopTypographyLink;

export { ShopTypographyText, ShopTypographyTitle, ShopTypographyParagraph, ShopTypographyLink };
export default ShopTypography;
