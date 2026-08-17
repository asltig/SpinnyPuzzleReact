//
//  UIView+ShadowsIO.m
//  CirclePuzzle
//
//  Created by Gevorg Nanyan on 2/28/18.
//  Copyright © 2018 MagicDevs. All rights reserved.
//

#import "UIView+ShadowsIO.h"
#define inerShadowTag 71717
#define shadowRadius 8

@implementation UIView (ShadowsIO)


-(void)md_outterShadow:(CircleView *)circle withShadowOpacity:(NSInteger)opacity in:(BOOL)isIn {
    
    //Out Shadow
    
    if (isIn) {
        [circle.circleLayerView.layer setMasksToBounds:NO];
        [circle.circleLayerView.layer setShadowColor:[UIColor blackColor].CGColor];
        [circle.circleLayerView.layer setShadowOpacity:opacity];
        [circle.circleLayerView.layer setShadowRadius:shadowRadius];
        [circle.circleLayerView.layer setShadowOffset:CGSizeMake(0, 0)];
    } else {
        [circle.layer setMasksToBounds:NO];
        [circle.layer setShadowColor:[UIColor blackColor].CGColor];
        [circle.layer setShadowOpacity:opacity];
        [circle.layer setShadowRadius:shadowRadius];
        [circle.layer setShadowOffset:CGSizeMake(0, 0)];
    }
}



-(void)md_innerShadow:(CircleView *)circle {
    
    UIView *innerShadow = [[UIView alloc] initWithFrame:circle.bounds];
    
    //Tag
    innerShadow.tag = inerShadowTag + circle.tag;
    
    //Inner Shadow
    CAShapeLayer* shadowLayer = [CAShapeLayer layer];
    
    [shadowLayer setFrame:[circle bounds]];
    
    // Standard shadow stuff
    [shadowLayer setShadowColor:[[UIColor colorWithWhite:0 alpha:1] CGColor]];
    [shadowLayer setShadowOffset:CGSizeMake(0.0f, 0.0f)];
    [shadowLayer setShadowOpacity:1.0f];
    [shadowLayer setShadowRadius:8];
    
    // Causes the inner region in this example to NOT be filled.
    [shadowLayer setFillRule:kCAFillRuleEvenOdd];
    
    
    [circle.layer setMasksToBounds:YES];
    
    // Create the larger rectangle path.
    CGMutablePathRef path = CGPathCreateMutable();
    CGPathAddRect(path, NULL, CGRectInset(circle.bounds, -42, -42));
    
    // Add the inner path so it's subtracted from the outer path.
    // someInnerPath could be a simple bounds rect, or maybe
    // a rounded one for some extra fanciness.
    
    CAShapeLayer *shapeL = [CAShapeLayer layer];
    
    float radius = circle.bounds.size.width/2;
    shapeL.path = [UIBezierPath bezierPathWithRoundedRect:CGRectMake(0, 0, 2.0*radius, 2.0*radius) cornerRadius:radius].CGPath;
//    circle.circleShapeLayer.lineDashPattern = @[@5, @6];
    
    CGPathAddPath(path, NULL, shapeL.path);
    CGPathCloseSubpath(path);
    
    [shadowLayer setPath:path];
    CGPathRelease(path);
    
    [[innerShadow layer] addSublayer:shadowLayer];
    
    [circle addSubview:innerShadow];
}


@end
