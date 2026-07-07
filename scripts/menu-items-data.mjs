export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Category-level styling hints for image prompts */
const categoryStyle = {
  "Cold Coffee":
    "iced coffee drink in tall glass with foam, Indian cafe style, condensation on glass",
  "Coffee / Hot":
    "hot coffee in white ceramic cup with latte art or espresso, cozy cafe",
  Tea: "Indian tea chai in glass or kulhad, steaming, authentic street cafe style",
  Shakes: "thick creamy milkshake in tall glass with straw, colorful layers",
  Coolers: "refreshing cold mocktail drink in tall glass with ice and garnish",
  Noodles: "Indian instant noodles bowl with vegetables, street food style, steaming hot",
  Pasta: "Italian penne pasta on white plate, creamy or tomato sauce, garnished with herbs",
  Burger: "vegetarian burger with thick patty lettuce tomato in sesame bun, Indian cafe style",
  "Grilled Sandwiches":
    "grilled sandwich cut diagonally showing colorful vegetable filling, golden toasted bread",
  "Sub Sandwiches": "long sub sandwich with fresh vegetables and paneer filling",
  Wrap: "vegetable paneer wrap cut in half showing colorful filling in tortilla",
  Fries: "crispy golden french fries in basket or paper cone, seasoned toppings",
  Extra: "simple Indian cafe side dish on small plate, clean presentation",
  "Add-ons": "small ramekin or portion of cafe add-on, minimal styling",
};

export function buildImagePrompt(category, name) {
  const style = categoryStyle[category] || "Indian vegetarian cafe food";
  return [
    `Professional high-end food photography of ${name}`,
    style,
    "appetizing, sharp focus, soft natural window lighting",
    "clean neutral background, restaurant menu hero shot",
    "photorealistic, 8k quality, no text, no watermark, no logo",
  ].join(", ");
}

export const categories = [
  { name: "Cold Coffee", sort_order: 1 },
  { name: "Coffee / Hot", sort_order: 2 },
  { name: "Tea", sort_order: 3 },
  { name: "Shakes", sort_order: 4 },
  { name: "Coolers", sort_order: 5 },
  { name: "Noodles", sort_order: 6 },
  { name: "Pasta", sort_order: 7 },
  { name: "Burger", sort_order: 8 },
  { name: "Grilled Sandwiches", sort_order: 9 },
  { name: "Sub Sandwiches", sort_order: 10 },
  { name: "Wrap", sort_order: 11 },
  { name: "Fries", sort_order: 12 },
  { name: "Extra", sort_order: 13 },
  { name: "Add-ons", sort_order: 14 },
];

/** [category, name, description, price] */
export const items = [
  ["Cold Coffee", "Classic Cold Coffee", "", 89],
  ["Cold Coffee", "Iced Americano", "", 99],
  ["Cold Coffee", "Iced Mocha", "", 109],
  ["Cold Coffee", "Caramel", "", 129],
  ["Cold Coffee", "Tiramisu", "", 139],
  ["Cold Coffee", "Hazelnut", "", 149],
  ["Cold Coffee", "Premium Cold Coffee", "", 149],
  ["Cold Coffee", "Vietnamese Cold Coffee", "", 149],

  ["Coffee / Hot", "Cappuccino", "", 99],
  ["Coffee / Hot", "Espresso", "", 99],
  ["Coffee / Hot", "Americano", "", 99],
  ["Coffee / Hot", "Coffee Latte", "", 119],
  ["Coffee / Hot", "Hot Chocolate", "", 149],

  ["Tea", "Kadak Chai", "", 29],
  ["Tea", "Masala Chai", "", 30],
  ["Tea", "Adarak Elaichi Chai", "", 30],
  ["Tea", "Gud Wali Chai", "", 36],
  ["Tea", "Haldi Chai", "", 36],
  ["Tea", "Green Tea", "", 29],
  ["Tea", "Green Tea with Honey", "", 39],
  ["Tea", "Honey Ginger Lemon Tea", "", 39],

  ["Shakes", "Korean Banana", "", 89],
  ["Shakes", "Alphonso Mango", "", 99],
  ["Shakes", "Oreo Shake", "", 119],
  ["Shakes", "Kit-Kat Shake", "", 129],
  ["Shakes", "Strawberry Love", "", 129],
  ["Shakes", "Mixed Berry", "", 139],

  ["Coolers", "Mint Mojito", "", 99],
  ["Coolers", "Spicy Lemonade", "", 99],
  ["Coolers", "Watermelon", "", 99],
  ["Coolers", "Spicy Mango (Aam Panna)", "", 99],
  ["Coolers", "Chilli Guava", "", 99],
  ["Coolers", "Green Apple", "", 99],
  ["Coolers", "Passion Fruit", "", 99],
  ["Coolers", "Blueberry", "", 99],
  ["Coolers", "Peach", "", 99],
  ["Coolers", "Iced Tea", "", 99],
  ["Coolers", "Blue Lagoon", "", 99],
  ["Coolers", "Peach Iced Tea", "", 99],

  ["Noodles", "Maggi", "", 79],
  ["Noodles", "Yippee", "", 79],
  ["Noodles", "Wai Wai", "", 79],

  ["Pasta", "White Sauce Pasta", "", 149],
  ["Pasta", "Red Sauce Pasta", "", 149],
  ["Pasta", "Pink Sauce Pasta", "", 159],

  ["Burger", "Aloo Tikki Burger", "", 69],
  ["Burger", "Veg Crispy Burger", "", 99],
  ["Burger", "Schezwan Burger", "", 89],
  ["Burger", "Achari Masti Burger", "", 99],
  ["Burger", "Peri-Peri Nachos Burger", "", 109],
  ["Burger", "Tandoori Paneer Burger", "", 119],

  ["Grilled Sandwiches", "Rainbow Sandwich", "", 109],
  ["Grilled Sandwiches", "Moms Kitchen Magic Sandwich", "Teakkuz Special", 119],
  ["Grilled Sandwiches", "Cheese Corn Sandwich", "", 129],
  ["Grilled Sandwiches", "Classic Paneer Sandwich", "", 139],

  ["Sub Sandwiches", "Garden Fresh", "Teakkuz Special", 139],
  ["Sub Sandwiches", "Schezwan Paneer Sub", "", 169],

  ["Wrap", "Aloo Tikki Wrap", "", 109],
  ["Wrap", "Veggie Delite Wrap", "", 99],
  ["Wrap", "Achari Paneer Wrap", "", 129],
  ["Wrap", "Paneer Wrap", "", 119],

  ["Fries", "Classic Salted Fries", "", 89],
  ["Fries", "Peri-Peri Fries", "", 99],
  ["Fries", "Chatkara Fries", "", 109],
  ["Fries", "Cheese Loaded Fries", "", 129],
  ["Fries", "Pizza Pocket", "", 119],
  ["Fries", "Cheese Corn", "", 109],

  ["Extra", "Bun Maska", "", 49],
  ["Extra", "Mix Salad Bowl", "", 89],
  ["Extra", "Sweet Corn", "", 119],

  ["Add-ons", "Dip", "Extra", 15],
  ["Add-ons", "Cheese Slice", "Extra", 20],
  ["Add-ons", "Honey", "Extra", 20],
  ["Add-ons", "Espresso Shot", "Extra", 69],
];

export function itemImagePath(name) {
  return `/menu/items/${slugify(name)}.jpg`;
}

export function enrichedItems() {
  return items.map(([category, name, description, price]) => ({
    category,
    name,
    description,
    price,
    slug: slugify(name),
    image_url: itemImagePath(name),
    prompt: buildImagePrompt(category, name),
  }));
}
