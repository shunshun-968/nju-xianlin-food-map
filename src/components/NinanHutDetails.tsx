import { useId } from 'react';
import type { NinanMealMode } from '../data/ninan-hut';
import './ninan-hut.css';

const breakfastBoard = new URL('../assets/ninan-hut/breakfast-board.webp', import.meta.url).href;
const drinksBoard = new URL('../assets/ninan-hut/drinks-board.webp', import.meta.url).href;
const breakfastReference = new URL('../assets/ninan-hut/breakfast-reference.webp', import.meta.url)
  .href;
const eastReference = new URL('../assets/ninan-hut/east-reference.webp', import.meta.url).href;
const nightReference = new URL('../assets/ninan-hut/night-reference.webp', import.meta.url).href;
const ingredientsReference = new URL(
  '../assets/ninan-hut/ingredients-reference.webp',
  import.meta.url,
).href;
const grillReference = new URL('../assets/ninan-hut/grill-reference.webp', import.meta.url).href;

type MealProps = {
  meal: NinanMealMode;
  onMealChange: (meal: NinanMealMode) => void;
  idPrefix?: string;
};

const meals = [
  { id: 'breakfast', label: '早餐', offering: '早茶' },
  { id: 'lunch', label: '午餐', offering: '饮品' },
  { id: 'dinner', label: '晚餐', offering: '烧烤' },
] as const;

/** One controlled value drives both the exterior and its detail board. */
export function NinanMealTabs({
  meal,
  onMealChange,
  idPrefix,
  showLabel = true,
}: MealProps & { showLabel?: boolean }) {
  const generatedId = useId();
  const labelId = `${idPrefix ?? generatedId}-meal-label`;
  return (
    <div className="ninan-meal-switch">
      {showLabel && (
        <span id={labelId} className="ninan-meal-label">
          选择餐段
        </span>
      )}
      <div
        className="ninan-meal-tabs"
        role="group"
        aria-labelledby={showLabel ? labelId : undefined}
        aria-label={showLabel ? undefined : '选择餐段'}
      >
        {meals.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={meal === item.id}
            onClick={() => onMealChange(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.offering}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Photos and sample prices are transcribed from the supplied on-site boards. */
export function NinanHutDetails({ meal, onMealChange, idPrefix }: MealProps) {
  const breakfast = meal === 'breakfast';
  const dinner = meal === 'dinner';
  const board = breakfast ? breakfastBoard : drinksBoard;
  return (
    <div className="ninan-details" data-meal={meal}>
      <NinanMealTabs meal={meal} onMealChange={onMealChange} idPrefix={idPrefix} />
      {dinner ? (
        <>
          <figure className="ninan-reference">
            <img
              src={nightReference}
              alt="呢喃小屋夜间实拍：发光鲜食柜、白色小棚下的烧烤台和露台灯带"
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
            />
            <figcaption>晚餐 · 小棚下的烧烤</figcaption>
          </figure>
          <p className="ninan-location-note">
            在“油炸烧烤”玻璃门面外的鲜食柜挑选食材，到白色小棚下现烤。小屋内的饮料机仍保留在原位。
          </p>
          <a
            className="ninan-board-link"
            href={ingredientsReference}
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={ingredientsReference}
              alt="油炸烧烤门面外的鲜食柜，柜内分层摆放食材"
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
            />
            <span>鲜食柜 · 查看实拍 ↗</span>
          </a>
          <a className="ninan-board-link" href={grillReference} target="_blank" rel="noreferrer">
            <img
              src={grillReference}
              alt="白色小棚下的烧烤架、不锈钢操作台与餐盘"
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
            />
            <span>烧烤架 · 查看实拍 ↗</span>
          </a>
        </>
      ) : (
        <>
          <figure className="ninan-reference">
            <img
              src={breakfast ? breakfastReference : eastReference}
              alt={
                breakfast
                  ? '呢喃小屋东北侧白色小棚，棚下为早餐售卖柜台'
                  : '呢喃小屋北侧木框窗口、白色遮阳棚与室外露台'
              }
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
            />
            <figcaption>{breakfast ? '早茶在小棚下' : '午间到窗口选一杯饮品'}</figcaption>
          </figure>
          <p className="ninan-location-note">
            {breakfast
              ? '早餐在小屋东北侧的独立白色棚下售卖，早餐套餐牌立在棚子东南侧。'
              : '咖啡、奶茶、果茶与鲜榨果汁。饮品价目牌位于北侧“咖啡饮品”窗口下方。'}
          </p>
          <section
            className="ninan-menu-samples"
            aria-label={breakfast ? '早餐套餐参考价格' : '饮品参考价格'}
          >
            <h3>{breakfast ? '早餐套餐' : '饮品选摘'}</h3>
            {breakfast ? (
              <>
                <dl>
                  <div>
                    <dt>板烧鸡腿堡套餐</dt>
                    <dd>¥9</dd>
                  </div>
                  <div>
                    <dt>火腿芝士三明治套餐</dt>
                    <dd>¥7</dd>
                  </div>
                  <div>
                    <dt>白水鸡蛋</dt>
                    <dd>¥1</dd>
                  </div>
                </dl>
                <p>以上两款套餐含现磨豆浆；加 ¥2 可升级咖啡或热牛奶。</p>
              </>
            ) : (
              <>
                <div className="ninan-price-head">
                  <span>饮品</span>
                  <span>售价 / 校内优惠价</span>
                </div>
                <dl>
                  <div>
                    <dt>美式咖啡</dt>
                    <dd>¥6.9 / ¥5</dd>
                  </div>
                  <div>
                    <dt>拿铁咖啡</dt>
                    <dd>¥8.9 / ¥6</dd>
                  </div>
                  <div>
                    <dt>生椰拿铁</dt>
                    <dd>¥10.9 / ¥8</dd>
                  </div>
                  <div>
                    <dt>柠檬水</dt>
                    <dd>¥4.5 / ¥4</dd>
                  </div>
                </dl>
              </>
            )}
            <p className="ninan-price-note">价格摘自实拍价目牌，以现场公示为准。</p>
          </section>
          <a className="ninan-board-link" href={board} target="_blank" rel="noreferrer">
            <img
              src={board}
              alt={breakfast ? '呢喃小屋早餐套餐完整价目牌实拍' : '呢喃小屋饮品完整价目牌实拍'}
              width="1950"
              height="2600"
              loading="lazy"
              decoding="async"
            />
            <span>查看完整{breakfast ? '早餐' : '饮品'}价目牌 ↗</span>
          </a>
        </>
      )}
    </div>
  );
}
