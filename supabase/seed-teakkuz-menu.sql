-- Teakkuzz Cafe menu — run in Supabase SQL Editor to replace the sample menu
-- Safe: order_items store item names, not menu_item IDs

delete from menu_items;
delete from menu_categories;

insert into menu_categories (name, sort_order) values
  ('Cold Coffee', 1),
  ('Coffee / Hot', 2),
  ('Tea', 3),
  ('Shakes', 4),
  ('Coolers', 5),
  ('Noodles', 6),
  ('Pasta', 7),
  ('Burger', 8),
  ('Grilled Sandwiches', 9),
  ('Sub Sandwiches', 10),
  ('Wrap', 11),
  ('Fries', 12),
  ('Extra', 13),
  ('Add-ons', 14);

insert into menu_items (category_id, name, description, price, image_url)
select c.id, v.name, v.description, v.price, v.image_url
from (values
  -- Cold Coffee
  ('Cold Coffee', 'Classic Cold Coffee', '', 89, '/menu/categories/cold-coffee.jpg'),
  ('Cold Coffee', 'Iced Americano', '', 99, '/menu/categories/cold-coffee.jpg'),
  ('Cold Coffee', 'Iced Mocha', '', 109, '/menu/categories/cold-coffee.jpg'),
  ('Cold Coffee', 'Caramel', '', 129, '/menu/categories/cold-coffee.jpg'),
  ('Cold Coffee', 'Tiramisu', '', 139, '/menu/categories/cold-coffee.jpg'),
  ('Cold Coffee', 'Hazelnut', '', 149, '/menu/categories/cold-coffee.jpg'),
  ('Cold Coffee', 'Premium Cold Coffee', '', 149, '/menu/categories/cold-coffee.jpg'),
  ('Cold Coffee', 'Vietnamese Cold Coffee', '', 149, '/menu/categories/cold-coffee.jpg'),

  -- Coffee / Hot
  ('Coffee / Hot', 'Cappuccino', '', 99, '/menu/categories/hot-coffee.jpg'),
  ('Coffee / Hot', 'Espresso', '', 99, '/menu/categories/hot-coffee.jpg'),
  ('Coffee / Hot', 'Americano', '', 99, '/menu/categories/hot-coffee.jpg'),
  ('Coffee / Hot', 'Coffee Latte', '', 119, '/menu/categories/hot-coffee.jpg'),
  ('Coffee / Hot', 'Hot Chocolate', '', 149, '/menu/categories/hot-coffee.jpg'),

  -- Tea
  ('Tea', 'Kadak Chai', '', 29, '/menu/categories/tea.jpg'),
  ('Tea', 'Masala Chai', '', 30, '/menu/categories/tea.jpg'),
  ('Tea', 'Adarak Elaichi Chai', '', 30, '/menu/categories/tea.jpg'),
  ('Tea', 'Gud Wali Chai', '', 36, '/menu/categories/tea.jpg'),
  ('Tea', 'Haldi Chai', '', 36, '/menu/categories/tea.jpg'),
  ('Tea', 'Green Tea', '', 29, '/menu/categories/tea.jpg'),
  ('Tea', 'Green Tea with Honey', '', 39, '/menu/categories/tea.jpg'),
  ('Tea', 'Honey Ginger Lemon Tea', '', 39, '/menu/categories/tea.jpg'),

  -- Shakes
  ('Shakes', 'Korean Banana', '', 89, '/menu/categories/shakes.jpg'),
  ('Shakes', 'Alphonso Mango', '', 99, '/menu/categories/shakes.jpg'),
  ('Shakes', 'Oreo Shake', '', 119, '/menu/categories/shakes.jpg'),
  ('Shakes', 'Kit-Kat Shake', '', 129, '/menu/categories/shakes.jpg'),
  ('Shakes', 'Strawberry Love', '', 129, '/menu/categories/shakes.jpg'),
  ('Shakes', 'Mixed Berry', '', 139, '/menu/categories/shakes.jpg'),

  -- Coolers
  ('Coolers', 'Mint Mojito', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Spicy Lemonade', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Watermelon', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Spicy Mango (Aam Panna)', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Chilli Guava', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Green Apple', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Passion Fruit', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Blueberry', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Peach', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Iced Tea', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Blue Lagoon', '', 99, '/menu/categories/coolers.jpg'),
  ('Coolers', 'Peach Iced Tea', '', 99, '/menu/categories/coolers.jpg'),

  -- Noodles
  ('Noodles', 'Maggi', '', 79, '/menu/categories/noodles.jpg'),
  ('Noodles', 'Yippee', '', 79, '/menu/categories/noodles.jpg'),
  ('Noodles', 'Wai Wai', '', 79, '/menu/categories/noodles.jpg'),

  -- Pasta
  ('Pasta', 'White Sauce Pasta', '', 149, '/menu/categories/pasta.jpg'),
  ('Pasta', 'Red Sauce Pasta', '', 149, '/menu/categories/pasta.jpg'),
  ('Pasta', 'Pink Sauce Pasta', '', 159, '/menu/categories/pasta.jpg'),

  -- Burger
  ('Burger', 'Aloo Tikki Burger', '', 69, '/menu/categories/burger.jpg'),
  ('Burger', 'Veg Crispy Burger', '', 99, '/menu/categories/burger.jpg'),
  ('Burger', 'Schezwan Burger', '', 89, '/menu/categories/burger.jpg'),
  ('Burger', 'Achari Masti Burger', '', 99, '/menu/categories/burger.jpg'),
  ('Burger', 'Peri-Peri Nachos Burger', '', 109, '/menu/categories/burger.jpg'),
  ('Burger', 'Tandoori Paneer Burger', '', 119, '/menu/categories/burger.jpg'),

  -- Grilled Sandwiches
  ('Grilled Sandwiches', 'Rainbow Sandwich', '', 109, '/menu/categories/grilled-sandwiches.jpg'),
  ('Grilled Sandwiches', 'Moms Kitchen Magic Sandwich', 'Teakkuz Special', 119, '/menu/categories/grilled-sandwiches.jpg'),
  ('Grilled Sandwiches', 'Cheese Corn Sandwich', '', 129, '/menu/categories/grilled-sandwiches.jpg'),
  ('Grilled Sandwiches', 'Classic Paneer Sandwich', '', 139, '/menu/categories/grilled-sandwiches.jpg'),

  -- Sub Sandwiches
  ('Sub Sandwiches', 'Garden Fresh', 'Teakkuz Special', 139, '/menu/categories/sub-sandwiches.jpg'),
  ('Sub Sandwiches', 'Schezwan Paneer Sub', '', 169, '/menu/categories/sub-sandwiches.jpg'),

  -- Wrap
  ('Wrap', 'Aloo Tikki Wrap', '', 109, '/menu/categories/wrap.jpg'),
  ('Wrap', 'Veggie Delite Wrap', '', 99, '/menu/categories/wrap.jpg'),
  ('Wrap', 'Achari Paneer Wrap', '', 129, '/menu/categories/wrap.jpg'),
  ('Wrap', 'Paneer Wrap', '', 119, '/menu/categories/wrap.jpg'),

  -- Fries
  ('Fries', 'Classic Salted Fries', '', 89, '/menu/categories/fries.jpg'),
  ('Fries', 'Peri-Peri Fries', '', 99, '/menu/categories/fries.jpg'),
  ('Fries', 'Chatkara Fries', '', 109, '/menu/categories/fries.jpg'),
  ('Fries', 'Cheese Loaded Fries', '', 129, '/menu/categories/fries.jpg'),
  ('Fries', 'Pizza Pocket', '', 119, '/menu/categories/fries.jpg'),
  ('Fries', 'Cheese Corn', '', 109, '/menu/categories/fries.jpg'),

  -- Extra
  ('Extra', 'Bun Maska', '', 49, '/menu/categories/extra.jpg'),
  ('Extra', 'Mix Salad Bowl', '', 89, '/menu/categories/extra.jpg'),
  ('Extra', 'Sweet Corn', '', 119, '/menu/categories/extra.jpg'),

  -- Add-ons
  ('Add-ons', 'Dip', 'Extra', 15, '/menu/categories/add-ons.jpg'),
  ('Add-ons', 'Cheese Slice', 'Extra', 20, '/menu/categories/add-ons.jpg'),
  ('Add-ons', 'Honey', 'Extra', 20, '/menu/categories/add-ons.jpg'),
  ('Add-ons', 'Espresso Shot', 'Extra', 69, '/menu/categories/add-ons.jpg')
) as v(cat, name, description, price, image_url)
join menu_categories c on c.name = v.cat;
