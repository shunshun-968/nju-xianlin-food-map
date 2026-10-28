import { useId } from 'react';
import type { NinanMealMode } from '../data/ninan-hut';
import './ninan-hut.css';

type MealProps = {
  meal: NinanMealMode;
  onMealChange: (meal: NinanMealMode) => void;
  idPrefix?: string;
};

const meals = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
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
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 菜单文字摘自现场价目牌，详情不展示实拍照片。 */
export function NinanHutDetails({ meal, onMealChange, idPrefix }: MealProps) {
  const breakfast = meal === 'breakfast';
  const dinner = meal === 'dinner';
  return (
    <div className="ninan-details" data-meal={meal}>
      <NinanMealTabs meal={meal} onMealChange={onMealChange} idPrefix={idPrefix} />
      {dinner ? (
        <p className="ninan-location-note">
          在“油炸烧烤”玻璃门面外的鲜食柜挑选食材，到白色小棚下现烤。小屋内的饮料机仍保留在原位。
        </p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
