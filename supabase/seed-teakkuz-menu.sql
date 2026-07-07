-- Teakkuzz Cafe menu — run in Supabase SQL Editor to replace the sample menu
-- Safe: order_items store item names, not menu_item IDs

delete from menu_items;
delete from menu_categories;

insert into menu_categories (name, sort_order) values
  ('Noodles', 1),
  ('Pasta', 2),
  ('Burger', 3),
  ('Grilled Sandwiches', 4),
  ('Sub Sandwiches', 5),
  ('Wrap', 6),
  ('Fries', 7),
  ('Extra', 8),
  ('Add-ons', 9);

insert into menu_items (category_id, name, description, price)
select c.id, v.name, v.description, v.price
from (values
  ('Noodles', 'Maggi', '', 79),
  ('Noodles', 'Yippee', '', 79),
  ('Noodles', 'Wai Wai', '', 79),

  ('Pasta', 'White Sauce Pasta', '', 149),
  ('Pasta', 'Red Sauce Pasta', '', 149),
  ('Pasta', 'Pink Sauce Pasta', '', 159),

  ('Burger', 'Aloo Tikki Burger', '', 69),
  ('Burger', 'Veg. Crispy Burger', '', 99),
  ('Burger', 'Schezwan Burger', '', 89),
  ('Burger', 'Achari Masti Burger', '', 99),
  ('Burger', 'Peri-Peri Nachos Burger', '', 109),
  ('Burger', 'Tandoori Paneer Burger', '', 119),

  ('Grilled Sandwiches', 'Rainbow Sandwich', '', 109),
  ('Grilled Sandwiches', 'Moms Kitchen Magic Sandwich', 'Teakkuz Special', 119),
  ('Grilled Sandwiches', 'Cheese Corn Sandwich', '', 129),
  ('Grilled Sandwiches', 'Classic Paneer Sandwich', '', 139),

  ('Sub Sandwiches', 'Garden Fresh', 'Teakkuz Special', 139),
  ('Sub Sandwiches', 'Schezwan Paneer Sub', '', 169),

  ('Wrap', 'Aloo Tikki Wrap', '', 109),
  ('Wrap', 'Veggie Delite Wrap', '', 99),
  ('Wrap', 'Achari Paneer Wrap', '', 129),
  ('Wrap', 'Paneer Wrap', '', 119),

  ('Fries', 'Classic Salted Fries', '', 89),
  ('Fries', 'Peri-Peri Fries', '', 99),
  ('Fries', 'Chatkara Fries', '', 109),
  ('Fries', 'Cheese Loaded Fries', '', 129),
  ('Fries', 'Pizza Pocket', '', 119),
  ('Fries', 'Cheese Corn', '', 109),

  ('Extra', 'Bun Maska', '', 49),
  ('Extra', 'Mix Salad Bowl', '', 89),
  ('Extra', 'Sweet Corn', '', 119),

  ('Add-ons', 'Dip', 'Extra', 15),
  ('Add-ons', 'Cheese Slice', 'Extra', 20),
  ('Add-ons', 'Honey', 'Extra', 20),
  ('Add-ons', 'Espresso Shot', 'Extra', 69)
) as v(cat, name, description, price)
join menu_categories c on c.name = v.cat;
