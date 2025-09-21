# Techafon Database Schema

This directory contains the database migrations for the Techafon electronics marketplace platform.

## Database Tables

### 1. Shops Table (`shops`)
Stores shop information for each user.

**Key Fields:**
- `user_id` - References auth.users(id)
- `name` - Shop name
- `description` - Shop description
- `rating` - Average rating (0.00-5.00)
- `review_count` - Number of reviews
- `total_sales` - Total sales amount
- `total_views` - Total page views
- `active_listings` - Number of active parts
- `conversion_rate` - Sales conversion rate
- `avg_response_time_hours` - Average response time
- `customer_satisfaction` - Customer satisfaction percentage
- `repeat_customer_rate` - Repeat customer percentage

### 2. Parts Table (`parts`)
Stores electronic parts inventory for each shop.

**Key Fields:**
- `shop_id` - References shops(id)
- `name` - Part name
- `description` - Part description
- `category` - Part category
- `price` - Selling price
- `cost` - Cost price (for refurbished parts)
- `stock_quantity` - Available stock
- `status` - active, inactive, out_of_stock, sold, draft
- `part_type` - original, refurbished
- `original_condition` - For refurbished parts
- `refurbished_condition` - For refurbished parts
- `time_spent_hours` - Time spent refurbishing
- `profit` - Calculated profit (price - cost)
- `views` - Page view count
- `image_url` - Part image

### 3. Orders Table (`orders`)
Stores customer orders.

**Key Fields:**
- `shop_id` - References shops(id)
- `customer_id` - References auth.users(id) for registered users
- `order_number` - Auto-generated order number (ORD-001, ORD-002, etc.)
- `status` - pending, confirmed, processing, shipped, delivered, cancelled, refunded
- `total_amount` - Total order amount
- `subtotal` - Subtotal before tax/shipping
- `tax_amount` - Tax amount
- `shipping_amount` - Shipping cost
- `discount_amount` - Discount applied
- `payment_status` - pending, paid, failed, refunded
- `shipping_address` - JSONB shipping address
- `billing_address` - JSONB billing address

### 4. Order Items Table (`order_items`)
Stores individual items within orders.

**Key Fields:**
- `order_id` - References orders(id)
- `part_id` - References parts(id)
- `quantity` - Quantity ordered
- `unit_price` - Price per unit
- `total_price` - Total price for this item

### 5. Reviews Table (`reviews`)
Stores customer reviews for shops.

**Key Fields:**
- `shop_id` - References shops(id)
- `customer_id` - References auth.users(id)
- `order_id` - References orders(id) (optional)
- `rating` - 1-5 star rating
- `title` - Review title
- `comment` - Review comment
- `status` - pending, approved, rejected
- `is_verified` - True if from verified purchase

### 6. Shop Analytics Table (`shop_analytics`)
Stores daily analytics data for shops.

**Key Fields:**
- `shop_id` - References shops(id)
- `date` - Analytics date
- `page_views` - Daily page views
- `unique_visitors` - Daily unique visitors
- `orders_count` - Daily orders
- `total_sales` - Daily sales amount
- `conversion_rate` - Daily conversion rate
- `new_listings` - New parts listed
- `sold_listings` - Parts sold
- `new_customers` - New customers
- `returning_customers` - Returning customers

## Key Features

### Row Level Security (RLS)
All tables have RLS enabled with appropriate policies:
- Users can only access their own data
- Shop owners can manage their shop and parts
- Customers can view their own orders
- Public can view active parts and approved reviews

### Automatic Functions
- **Shop Creation**: Automatically creates a shop when a user signs up
- **Order Number Generation**: Auto-generates order numbers (ORD-001, ORD-002, etc.)
- **Profit Calculation**: Automatically calculates profit for refurbished parts
- **Rating Updates**: Updates shop ratings when reviews change
- **Order Totals**: Recalculates order totals when items change

### Helper Functions
- `get_shop_stats(shop_uuid)` - Get comprehensive shop statistics
- `get_shop_recent_orders(shop_uuid, limit)` - Get recent orders for a shop
- `search_parts(query, category, min_price, max_price, part_type, limit)` - Search parts with filters

## Usage

1. Run migrations in order:
   ```bash
   supabase db reset
   ```

2. The database will automatically:
   - Create all tables with proper relationships
   - Set up RLS policies
   - Create helper functions
   - Set up triggers for automatic calculations

3. When users sign up, a shop is automatically created for them

4. Use the helper functions in your application to get shop data and statistics

## Integration with Profile Page

The shop data integrates with the profile page fields:
- `shop_name` → `shops.name`
- `shop_description` → `shops.description`
- Shop statistics are calculated from the database
- Specializations can be stored in user metadata or as a separate table

## Dashboard Integration

The dashboard can use these functions to display:
- Shop statistics from `get_shop_stats()`
- Recent orders from `get_shop_recent_orders()`
- Parts inventory from the `parts` table
- Analytics data from `shop_analytics` table
